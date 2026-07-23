# aaPanel Octane + Reverb Notes

This project requires PHP 8.3 or newer. Do not run Octane/Reverb with a plain
`php` command if your server default PHP is 8.2.

On aaPanel, first find the PHP binary:

```bash
/www/server/php/83/bin/php -v
/www/server/php/84/bin/php -v
```

Use the first PHP binary that reports version 8.3 or newer.

Example Supervisor commands for aaPanel:

```ini
command=/www/server/php/83/bin/php artisan octane:start --server=roadrunner --host=127.0.0.1 --port=8000 --max-requests=500
```

```ini
command=/www/server/php/83/bin/php artisan reverb:start --host=0.0.0.0 --port=8080
```

If your PHP path is different, replace `/www/server/php/83/bin/php` with the
actual PHP 8.3+ binary path.

Also replace `directory=` in the Supervisor files with the real project path on
the server, and replace `user=www-data` with the actual website user if aaPanel
uses `www` or another user.
