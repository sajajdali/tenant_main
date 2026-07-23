import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js', 'resources/js/admin-discount-codes.js', 'resources/js/admin-ir-domain-renewals.js', 'resources/js/admin-sales-team.js', 'resources/js/admin-specialized-courses.js'],
            refresh: true,
        }),
    ],
});
