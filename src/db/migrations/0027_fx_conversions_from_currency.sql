ALTER TABLE `fx_conversions` ADD `from_currency` text CONSTRAINT "fx_conversions_from_currency_check" CHECK(`from_currency` is null or `from_currency` in ('BRL', 'USD'));
