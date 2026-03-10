# KYC Sample Images

This directory contains sample/reference images that are displayed in the seller registration KYC verification step. These images help users understand what kind of documents are acceptable for each upload requirement.

## Current Sample Images

1. **id-sample.svg** - Example of government-issued ID (passport/national ID/driver's license)
2. **selfie-sample.svg** - Example of person holding ID with date written on paper
3. **address-sample.svg** - Example of utility bill or proof of address
4. **incorporation-sample.svg** - Example of certificate of incorporation
5. **license-sample.svg** - Example of business license
6. **bank-statement-sample.svg** - Example of bank statement

## Replacing Samples

The current files are placeholder SVG illustrations. You can replace them with actual photographs or more realistic examples by:

1. Adding PNG or JPG files with the same filenames (e.g., `id-sample.png` instead of `id-sample.svg`)
2. Updating the file paths in `/src/app/seller/register/page.tsx` if using different file extensions
3. Recommended image size: 200x140px (or similar aspect ratio)
4. Keep file sizes small (< 100KB) for fast loading

## Usage

These samples are displayed in small preview boxes (48-56px square) above each file upload field in the KYC verification step (Step 3) of the seller registration form.

## Design Guidelines

- Use clear, simple images that immediately communicate the document type
- Blur or redact any personal information if using real document photos
- Maintain consistency with the app's dark theme and gamer aesthetic
- Consider purple/primary color accents to match the brand
