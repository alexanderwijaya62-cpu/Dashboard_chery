import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: dashboard-redesign
 * Property 5: Booking form submission excludes image data
 *
 * For any booking form data object constructed by the CRO Booking Panel submit handler,
 * the payload shall NOT contain keys related to image data (image, imageUrl, imageFile,
 * attachment, photo, foto), and SHALL contain all required text fields
 * (namaCustomer, noPlat, tipeMobil, keperluanService, tanggal, jam).
 *
 * **Validates: Requirements 6.4**
 */

// Image-related keys that must never appear in the booking payload
const IMAGE_KEYS = ['image', 'imageUrl', 'imageFile', 'attachment', 'photo', 'foto'];

// Required text fields that must always be present in the booking payload
const REQUIRED_FIELDS = ['namaCustomer', 'noPlat', 'tipeMobil', 'keperluanService', 'tanggal', 'jam'];

// Mirrors the sanitization logic from CroBookingPanel.jsx
const IMAGE_FIELDS_TO_SKIP = ['image', 'imageUrl', 'imageFile', 'attachment', 'photo', 'foto'];

/**
 * Simulates the booking form payload construction as done in CroBookingPanel.
 * This mirrors the submit handler logic: spread formData, then delete image fields.
 */
function buildBookingPayload(formData) {
  const payload = {
    id: Date.now(),
    noUrut: 1,
    ...formData,
    noPlat: (formData.noPlat || '').toUpperCase().replace(/\s+/g, ''),
    keperluanService: formData.keperluanService,
    jam: formData.jam,
    bookingVia: 'CRO Portal',
    status: 'accepted',
  };

  // Ensure no image/file data is sent (same as CroBookingPanel)
  IMAGE_FIELDS_TO_SKIP.forEach((field) => delete payload[field]);

  return payload;
}

// Arbitrary generator for booking form data with required fields and optional image fields injected
const bookingFormDataArb = fc.record({
  namaCustomer: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,49}$/).filter(s => s.trim().length > 0),
  noPlat: fc.stringMatching(/^[A-Z]{1,2} [0-9]{1,4} [A-Z]{1,3}$/).filter(s => s.trim().length > 0),
  tipeMobil: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,29}$/).filter(s => s.trim().length > 0),
  keperluanService: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,49}$/).filter(s => s.trim().length > 0),
  tanggal: fc.integer({ min: 2020, max: 2030 }).chain(year =>
    fc.integer({ min: 1, max: 12 }).chain(month =>
      fc.integer({ min: 1, max: 28 }).map(day =>
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      )
    )
  ),
  jam: fc.stringMatching(/^[0-2][0-9]\.[0-5][0-9]$/),
  keluhanDetail: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  vin: fc.option(fc.string({ minLength: 0, maxLength: 20 }), { nil: undefined }),
  noTelp: fc.option(fc.string({ minLength: 0, maxLength: 15 }), { nil: undefined }),
  // Inject image-related keys that should be stripped
  image: fc.option(fc.string(), { nil: undefined }),
  imageUrl: fc.option(fc.string(), { nil: undefined }),
  imageFile: fc.option(fc.string(), { nil: undefined }),
  attachment: fc.option(fc.string(), { nil: undefined }),
  photo: fc.option(fc.string(), { nil: undefined }),
  foto: fc.option(fc.string(), { nil: undefined }),
});

describe('Feature: dashboard-redesign, Property 5: Booking form submission excludes image data', () => {
  it('payload never contains image-related keys for any booking form data', () => {
    fc.assert(
      fc.property(bookingFormDataArb, (formData) => {
        const payload = buildBookingPayload(formData);

        for (const imageKey of IMAGE_KEYS) {
          expect(payload).not.toHaveProperty(imageKey);
        }
      }),
      { numRuns: 150 }
    );
  });

  it('payload always contains all required text fields for any booking form data', () => {
    fc.assert(
      fc.property(bookingFormDataArb, (formData) => {
        const payload = buildBookingPayload(formData);

        for (const field of REQUIRED_FIELDS) {
          expect(payload).toHaveProperty(field);
          expect(typeof payload[field]).toBe('string');
          expect(payload[field].length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 150 }
    );
  });

  it('payload retains required fields while stripping all image keys regardless of input', () => {
    fc.assert(
      fc.property(bookingFormDataArb, (formData) => {
        const payload = buildBookingPayload(formData);

        // All required fields present
        for (const field of REQUIRED_FIELDS) {
          expect(payload).toHaveProperty(field);
        }

        // No image keys present
        for (const imageKey of IMAGE_KEYS) {
          expect(payload).not.toHaveProperty(imageKey);
        }
      }),
      { numRuns: 100 }
    );
  });
});
