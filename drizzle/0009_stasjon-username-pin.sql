DROP INDEX `user_loginTokenHash_idx`;--> statement-breakpoint
DROP INDEX `user_pinLookupHash_idx`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `login_token_hash`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `pin_lookup_hash`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `login_token_encrypted`;