import sharp from 'sharp';

await sharp('C:/Users/Paul/Desktop/PAULGOMES-BLOG/og.png')
  .resize(1200, 630, { fit: 'cover', position: 'center' })
  .png({ quality: 90 })
  .toFile('public/og-image.png');

console.log('✓ og-image.png gerado (1200x630)');
