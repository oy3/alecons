import { SitemapStream, streamToPromise } from 'sitemap';
import { createWriteStream } from 'fs';

(async () => {
  const sitemap = new SitemapStream({ hostname: 'https://alecons.com.ng' });

  const links = [
    { url: '/', changefreq: 'monthly', priority: 1.0 },
    { url: '/about', changefreq: 'monthly', priority: 0.8 },
    { url: '/programs', changefreq: 'monthly', priority: 0.8 },
    { url: '/admissions', changefreq: 'monthly', priority: 0.8 },
    { url: '/faculty', changefreq: 'monthly', priority: 0.8 },
    { url: '/contact', changefreq: 'monthly', priority: 0.7 }
    // Add more routes as needed
  ];

  links.forEach(link => sitemap.write(link));
  sitemap.end();

  const xml = await streamToPromise(sitemap);
  createWriteStream('./dist/sitemap.xml').write(xml);
})();
