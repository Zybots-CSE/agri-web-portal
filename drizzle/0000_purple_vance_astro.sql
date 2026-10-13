CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`district` text,
	`region` text,
	`zone` text,
	`crop` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `readings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` text NOT NULL,
	`ph` real NOT NULL,
	`ec` real NOT NULL,
	`moisture` real NOT NULL,
	`temperature` real NOT NULL,
	`nitrogen` real NOT NULL,
	`phosphorus` real NOT NULL,
	`potassium` real NOT NULL,
	`lat` real NOT NULL,
	`lon` real NOT NULL,
	`spot` text,
	`recorded_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `readings_device_recorded_idx` ON `readings` (`device_id`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `readings_recorded_idx` ON `readings` (`recorded_at`);