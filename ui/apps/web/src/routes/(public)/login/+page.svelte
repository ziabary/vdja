<script lang="ts">
  import { resolve } from '$app/paths';
  import { Select, TextInput, useLocale } from '@targoman/ui-core';
  import { useAuthClient } from '#lib/auth/client.svelte.js';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  const auth = useAuthClient();
  const locale = useLocale();
  let email = $state(''), password = $state(''), tenantId = $state('');
  let tenantOptions = $state<readonly string[]>([]), busy = $state(false), failed = $state(false);
  async function submit() {
    if (busy) return;
    busy = true; failed = false;
    try {
      const result = await auth.login(email, password, tenantId || undefined);
      if (result.kind === 'TENANT_SELECTION_REQUIRED') {
        tenantOptions = result.tenants; tenantId = result.tenants[0] ?? '';
      } else if (result.kind === 'INVALID') failed = true;
      else { password = ''; tenantOptions = []; }
    } catch { failed = true; }
    finally { busy = false; }
  }
</script>

<svelte:head><title>{locale.locale === 'fa' ? 'ورود' : 'Sign in'} · {data.brandName}</title></svelte:head>
<section class="card mx-auto my-5 p-4" style="max-width: 28rem" aria-label={locale.locale === 'fa' ? 'ورود به حساب' : 'Sign in'}>
  <h2 class="h4 mb-4">{locale.locale === 'fa' ? 'ورود به حساب' : 'Sign in'}</h2>
  {#if auth.state.tenantId}
    <p role="status">{locale.locale === 'fa' ? 'نشست فعال برای مستأجر' : 'Active session for tenant'} <b>{auth.state.tenantId}</b></p>
    <a href={resolve('/(public)')} class="btn btn-primary">{locale.locale === 'fa' ? 'بازگشت به خانه' : 'Back to home'}</a>
  {:else}
    <form onsubmit={event => { event.preventDefault(); void submit(); }} aria-busy={busy}>
      <TextInput id="login-email" label={locale.locale === 'fa' ? 'ایمیل' : 'Email'} value={email} onChange={value => email = value} autocomplete="email" dir="ltr" required disabled={busy} />
      <div class="mb-3"><label class="form-label" for="login-password">{locale.locale === 'fa' ? 'گذرواژه' : 'Password'}</label><input id="login-password" name="password" type="password" class="form-control" bind:value={password} autocomplete="current-password" required disabled={busy} /></div>
      {#if tenantOptions.length > 1}<Select id="login-tenant" label={locale.locale === 'fa' ? 'مستأجر' : 'Tenant'} value={tenantId} onChange={value => tenantId = value} options={tenantOptions.map(value => ({ value, label: value }))} required disabled={busy} />{/if}
      {#if failed}<p role="alert" class="alert alert-danger">{locale.locale === 'fa' ? 'ورود انجام نشد. اطلاعات را بررسی کنید.' : 'Sign in failed. Check your details.'}</p>{/if}
      <button class="btn btn-primary w-100" type="submit" disabled={busy}>{locale.locale === 'fa' ? 'ورود' : 'Sign in'}</button>
    </form>
  {/if}
</section>
