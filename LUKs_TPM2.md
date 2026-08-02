### Prerequisites and Warnings
Encrypting existing partitions with data is **highly risky** — one mistake can lead to permanent data loss. Since you mentioned you're able to reinstall the OS and set up everything again, **I strongly recommend doing a fresh installation of openSUSE Leap 15.6** with encryption enabled from the installer. This is safer, supports TPM auto-unlock more reliably (especially with recent advancements in YaST), and avoids complex post-install conversion.

If you proceed post-install, **back up all important data first** (e.g., to external drive). Both partitions are on NVMe (e.g., /dev/nvme0n1pX for root, /dev/nvme1n1pY for /data — adjust as needed).

The goal (auto-unlock on reboot with no password prompt) uses **systemd-cryptenroll with TPM2**, which works on Leap 15.6 (systemd supports it). It binds the LUKS key to TPM PCRs (platform configuration registers). Choose limited PCRs for less re-enrollment hassle (e.g., only PCR7 for Secure Boot — less secure against boot changes).

### Step 1: Enable TPM2 in Firmware (Supermicro Server)
- Reboot into BIOS (usually Del or F2 during POST).
- Go to **Advanced > Trusted Computing** (or similar section).
- Set **Security Device Support** or **TPM State** to **Enabled**.
- If present, set TPM to **TPM 2.0** mode.
- Save and exit (F10 + Enter).
- Verify in OS: `sudo tpm2_pcrread` (install tpm2-tools if needed: `sudo zypper in tpm2-tools`).

If your Supermicro board has a discrete TPM module (e.g., AOM-TPM-XXXX), ensure it's physically installed and recognized.

### Step 2: Fresh Install Recommendation (Safest for Auto-Unlock)
- Download openSUSE Leap 15.6 ISO.
- Boot from it.
- In YaST partitioner:
  - Enable encryption for root partition (and separate /data if desired).
  - YaST supports LUKS2 now; it may prompt for TPM/FIDO2 options in recent versions (experimental in 15.6, but works with systemd-boot).
- For full TPM auto-unlock during install:
  - Switch bootloader to **systemd-boot** (recommended for best TPM integration).
  - Enable Secure Boot if possible.
- After install, follow Step 4 to enroll TPM.

This often achieves passwordless reboot out-of-the-box with TPM.

### Step 3: Post-Install Setup (If Not Reinstalling — Risky!)
Assume root is not yet encrypted (common). For /data (separate partition), easier.

#### For /data partition (non-root — safer):
- Unmount if mounted: `sudo umount /data`
- Format as LUKS2: `sudo cryptsetup luksFormat --type luks2 /dev/nvmeXnY` (enter strong passphrase when prompted — this is fallback).
- Open: `sudo cryptsetup luksOpen /dev/nvmeXnY data_crypt`
- Format filesystem: `sudo mkfs.ext4 /dev/mapper/data_crypt` (or btrfs/xfs as preferred).
- Mount: `sudo mount /dev/mapper/data_crypt /data`
- Add to /etc/fstab: UUID of /dev/mapper/data_crypt  /data  ext4  defaults  0  2 (get UUID with `lsblk -f`).
- Add to /etc/crypttab: `data_crypt UUID=<luks-uuid> none` (get UUID: `sudo cryptsetup luksUUID /dev/nvmeXnY`).

#### For root (much riskier — requires live USB if issues):
- Boot from openSUSE live ISO.
- Encrypt and migrate data (complex — involves shrinking, copying; search "encrypt existing root openSUSE" or use tools like ecryptfs-migrate — not recommended).
- Better: Reinstall.

### Step 4: Enroll TPM2 for Auto-Unlock (Both Partitions)
Install tools: `sudo zypper in systemd-cryptenroll tpm2-tools`

For each encrypted device (repeat for root and /data):

- Enroll with TPM (will prompt for existing LUKS passphrase):
  `sudo systemd-cryptenroll --tpm2-device=auto --tpm2-pcrs=7 /dev/nvmeXnY`
  (Use PCRs=7 for basic Secure Boot protection; or 0+7 for more; or 0+2+4+7+9 for stronger — but re-enroll often if kernel/boot changes).

- Edit /etc/crypttab line for the device: add `tpm2-device=auto` to options column, e.g.:
  `root_crypt UUID=xxxx none tpm2-device=auto,x-initrd.attach`

  For non-root (/data): `data_crypt UUID=xxxx none tpm2-device=auto`

- Regenerate initrd: `sudo dracut -f`
- Update bootloader: `sudo grub2-mkconfig -o /boot/grub2/grub.cfg` (or `sudo update-bootloader` if applicable).

- Reboot and test.

If it prompts for password, check logs: `journalctl -b -1 | grep cryptenroll`

**Note**: Full auto-unlock (no fallback prompt ever) is possible with limited PCRs, but less secure. Always keep your LUKS recovery key/phrase safe (print it!).

If kernel updates change PCRs, re-enroll: repeat cryptenroll + dracut.

### Network Settings Change (Support User)
openSUSE Leap servers often use **wicked** or **NetworkManager**. To allow a non-root "support" user to change network (e.g., IP, DHCP):

- Preferred: Use NetworkManager (easier GUI).
  `sudo zypper in NetworkManager`
  `sudo systemctl disable wicked`
  `sudo systemctl enable --force NetworkManager`
  Reboot.
  Then add user to netconfig group or use polkit rules for passwordless nmcli/nm-applet.

- Or with wicked/systemd-networkd: Use `nmcli` or YaST (run as sudo).
- For headless server: Allow support user sudo access to network commands, e.g., add to /etc/sudoers:
  `supportuser ALL=(root) NOPASSWD: /usr/bin/nmcli, /sbin/ip, /usr/sbin/yast2 lan`

This meets "support user able to change network settings" without full root.

If issues, provide output of `lsblk -f`, `cat /etc/crypttab`, model of Supermicro for more tailored help. Good luck!
