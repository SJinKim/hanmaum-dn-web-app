import { TestBed } from '@angular/core/testing';

import { PlzService, parsePlzData } from './plz.service';

describe('parsePlzData', () => {
  it('adds up the deltas and keeps leading zeros', () => {
    const table = parsePlzData('1067\tDresden\n2\tDresden\n3741\tFalkenhain|Wurzen');
    expect(table.get('01067')).toEqual(['Dresden']);
    expect(table.get('01069')).toEqual(['Dresden']);
    expect(table.get('04810')).toEqual(['Falkenhain', 'Wurzen']);
  });
});

describe('PlzService (#174)', () => {
  let service: PlzService;

  beforeEach(() => {
    service = TestBed.inject(PlzService);
  });

  it('finds the Ort of a real PLZ in the shipped list', async () => {
    expect(await service.lookup('80331')).toEqual(['München']);
    expect(await service.lookup('04808')).toContain('Wurzen');
  });

  it('answers nothing for an incomplete or unknown PLZ', async () => {
    expect(await service.lookup('8033')).toEqual([]);
    expect(await service.lookup('00000')).toEqual([]);
  });
});
