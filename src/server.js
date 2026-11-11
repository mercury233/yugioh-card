import http from 'http';
import path from 'path';
import { YugiohCard } from 'yugioh-card';
import skia from 'skia-canvas';
import yugiohDemo from '@/assets/demo/yugioh-demo';

if (global.__server__) {
  global.__server__.close();
}

global.__server__ = http.createServer(async (req, res) => {
  let card;
  try {
    card = new YugiohCard({
      data: yugiohDemo,
      resourcePath: path.resolve('./src/assets/yugioh-card'),
      skia: skia,
    });
    await card.ready;
    const result = await card.leafer.export('png', {
      screenshot: true,
    });
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<img src="${result.data}" />`);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Failed to render card');
  } finally {
    card?.leafer.destroy();
  }
});

global.__server__.listen(3000, () => {
  console.log('server is running at http://localhost:3000');
});
