"use strict";

let profileState = { avatar: "" };

async function profileJSON(path, options = {}) {
  const response = await auth.apiFetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  if (!response) throw new Error("پاسخی از سرور دریافت نشد");
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data?.error?.message || data?.error || "خطا در ارتباط با سرور");
  return data;
}

function setProfileLoading(active) {
  document.getElementById("loading")?.classList.toggle("hidden", !active);
  const button = document.getElementById("btnSaveProfile");
  if (button) button.disabled = active;
}

function renderProfilePreview() {
  const setPreview = (previewId, value, placeholder, formatter = item => item) => {
    const preview = document.getElementById(previewId);
    preview.textContent = value ? formatter(value) : placeholder;
    preview.classList.toggle("profile-preview-placeholder", !value);
  };
  const name = document.getElementById("profileName").value.trim();
  const username = document.getElementById("profileUsername").value.trim();
  const organization = document.getElementById("profileOrganization").value.trim();
  const title = document.getElementById("profileTitle").value.trim();
  setPreview("profileNamePreview", name, "نام و نام خانوادگی");
  setPreview("profileUsernamePreview", username, "نام کاربری", item => `@${item}`);
  setPreview("profileRolePreview", title, "عنوان شغلی");
  setPreview("profileOrganizationPreview", organization, "سازمان یا شرکت");
  document.getElementById("profileAvatarPreview").innerHTML = profileState.avatar
    ? `<img src="${profileState.avatar}" alt="تصویر پروفایل">`
    : '<i class="fa-solid fa-user"></i>';
}

function fillProfile(profile) {
  profileState.avatar = profile.avatar || "";
  document.getElementById("profileName").value = profile.name || "";
  document.getElementById("profileUsername").value = profile.username || "";
  document.getElementById("profileOrganization").value = profile.organization || "";
  document.getElementById("profileTitle").value = profile.title || "";
  document.getElementById("profileEmail").value = profile.email || "";
  document.getElementById("profileMobile").value = profile.mobile || "";
  renderProfilePreview();
}

function imageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("فایل انتخاب‌شده تصویر نیست"));
    if (file.size > 5 * 1024 * 1024) return reject(new Error("حجم تصویر اولیه نباید بیش از ۵ مگابایت باشد"));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("خواندن تصویر ممکن نشد"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("تصویر معتبر نیست"));
      image.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const context = canvas.getContext("2d");
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL("image/jpeg", .84));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function saveProfile(event) {
  event.preventDefault();
  const username = document.getElementById("profileUsername").value.trim().toLowerCase();
  if (username && !/^[a-z][a-z0-9_-]{2,31}$/.test(username)) {
    toast("نام کاربری باید ۳ تا ۳۲ کاراکتر و شامل حروف کوچک انگلیسی، عدد، خط تیره یا زیرخط باشد", "warning");
    document.getElementById("profileUsername").focus();
    return;
  }
  setProfileLoading(true);
  try {
    const data = await profileJSON("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify({
        name: document.getElementById("profileName").value.trim(),
        username,
        organization: document.getElementById("profileOrganization").value.trim(),
        title: document.getElementById("profileTitle").value.trim(),
        avatar: profileState.avatar
      })
    });
    if (data.accessToken) auth.setAccessToken(data.accessToken);
    fillProfile(data.profile || {});
    toast("پروفایل ذخیره شد", "success");
  } catch (error) {
    toast(error.message || "ذخیره پروفایل ناموفق بود", "danger");
  } finally {
    setProfileLoading(false);
  }
}

async function initProfilePage() {
  setProfileLoading(true);
  try {
    const data = await profileJSON("/api/auth/profile");
    fillProfile(data.profile || {});
    ["profileName", "profileUsername", "profileOrganization", "profileTitle"].forEach(id => {
      document.getElementById(id).addEventListener("input", renderProfilePreview);
    });
    document.getElementById("profileForm").addEventListener("submit", saveProfile);
    document.getElementById("profileAvatarInput").addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try { profileState.avatar = await imageToDataUrl(file); renderProfilePreview(); }
      catch (error) { toast(error.message, "danger"); }
      event.target.value = "";
    });
    document.getElementById("btnRemoveAvatar").addEventListener("click", () => { profileState.avatar = ""; renderProfilePreview(); });
  } catch (error) {
    toast(error.message || "بارگذاری پروفایل ناموفق بود", "danger");
  } finally {
    setProfileLoading(false);
  }
}
