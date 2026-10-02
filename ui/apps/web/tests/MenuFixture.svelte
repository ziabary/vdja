<script lang="ts">
  import {DropdownMenu} from '@targoman/ui-core';
</script>

<DropdownMenu>
  {#snippet trigger()}Tools{/snippet}
  <a href="#selected">First</a>
  <button type="button" data-menu-close>Apply</button>
  <select aria-label="Choice"><option value="one">One</option><option value="two">Two</option></select>
</DropdownMenu>
