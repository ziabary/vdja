<script lang="ts">
  import {Dialog,Drawer} from '@targoman/ui-core';
  let dialogOpen=$state(false),drawerOpen=$state(false);
</script>
<button id="open-dialog" onclick={()=>dialogOpen=true}>باز کردن پنجره</button>
<button id="open-drawer" onclick={()=>drawerOpen=true}>باز کردن کشو</button>
<Dialog id="test-dialog" title="پنجره" open={dialogOpen} onClose={()=>dialogOpen=false}><button id="dialog-action" onclick={()=>dialogOpen=false}>تأیید</button></Dialog>
<Drawer id="test-drawer" title="کشو" open={drawerOpen} onClose={()=>drawerOpen=false}><button id="drawer-action" onclick={()=>drawerOpen=false}>تأیید</button></Drawer>
