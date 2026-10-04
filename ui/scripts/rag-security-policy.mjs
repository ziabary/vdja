/** T5 start depends only on open pre-T5 controls and named foundations. */
export function deriveSecurityGates(openControls, requiredControls) {
  const blocksT5Start = openControls.filter(control => control.blocksT5Start);
  const releaseBlocks = openControls.filter(control => control.blocksCustomerRelease);
  const failedFoundations = Object.entries(requiredControls)
    .filter(([, result]) => result.status !== 'PASS').map(([name]) => name);
  return {
    RAG_SECURITY_GATE: blocksT5Start.length === 0 && failedFoundations.length === 0 ? 'YES' : 'NO',
    ASVS_L3_RELEASE_GATE: releaseBlocks.length === 0 ? 'YES' : 'NO',
    blocksT5Start,
    releaseBlocks,
    failedFoundations
  };
}
