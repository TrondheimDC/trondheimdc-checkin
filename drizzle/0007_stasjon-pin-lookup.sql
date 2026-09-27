ALTER TABLE `user` ADD `pin_lookup_hash` text;--> statement-breakpoint
CREATE INDEX `user_pinLookupHash_idx` ON `user` (`pin_lookup_hash`);