import {describe,it,expect} from 'vitest';
import {parsePublicBrand,brandTokens} from '@targoman/branding';
import {anonymousBootstrap} from '../src/lib/server/bootstrap.js';

describe('package and visual-brand separation',()=>{
  it('renders the selected profile values independently of the package namespace',()=>{
    const fapa=parsePublicBrand({version:'fapa-1',displayName:'FAPA',shortName:'FAPA',primaryColor:'#112233'});
    const customer=parsePublicBrand({version:'customer-1',displayName:'Customer',shortName:'Customer',primaryColor:'#445566'});
    expect(fapa.displayName).toBe('FAPA');
    expect(customer.displayName).toBe('Customer');
    expect(brandTokens(fapa)['--brand-primary']).not.toBe(brandTokens(customer)['--brand-primary']);
    expect(anonymousBootstrap('fa','system').brand.displayName).toBe('Workspace');
  });
});
