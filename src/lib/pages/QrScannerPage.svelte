<script lang="ts">
  import { _ } from 'svelte-i18n';
  import QrScanner from '../components/QrScanner.svelte';
  
  let scannedValue = '';
  
  function handleQrScan(data: string) {
    scannedValue = data;
    // You could also process the QR code data here
    // e.g., check if it's a URL, a contact, etc.
  }
</script>

<div class="max-w-lg mx-auto">
  <h2 class="text-xl font-semibold mb-4">{$_('qrScanner.title')}</h2>
  
  <QrScanner onScan={handleQrScan} />
  
  {#if scannedValue}
    <div class="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
      <h3 class="text-lg font-medium mb-2">{$_('qrScanner.scanned')}</h3>
      <div class="bg-white p-3 rounded border border-gray-200 break-all">
        {scannedValue}
      </div>
    </div>
  {/if}
</div>
