import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { MinistryService } from './ministry.service';

describe('MinistryService', () => {
  let service: MinistryService;
  let api: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['postForm']);

    TestBed.configureTestingModule({
      providers: [
        MinistryService,
        { provide: ApiService, useValue: api },
      ],
    });

    service = TestBed.inject(MinistryService);
  });

  it('uploads the selected ministry image as multipart form data', () => {
    const file = new File(['image'], 'ministry.png', { type: 'image/png' });
    api.postForm.and.returnValue(of({ imageUrl: 'https://api.example.com/image' }));

    service.uploadImage(file).subscribe();

    expect(api.postForm).toHaveBeenCalledTimes(1);
    const [path, formData] = api.postForm.calls.mostRecent().args;
    expect(path).toBe('/v1/ministries/images');
    expect(formData.get('file')).toBe(file);
  });
});
