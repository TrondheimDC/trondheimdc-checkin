DELETE FROM check_events WHERE attendee_id IN ('test', 'bjorn', 'a-1001', 'a-1002', 'a-1003', 'a-1004', 'a-1005', 'a-1006', 'a-1007', 'a-1008', 'a-1009', 'a-1010');--> statement-breakpoint
DELETE FROM attendees WHERE id IN ('test', 'bjorn', 'a-1001', 'a-1002', 'a-1003', 'a-1004', 'a-1005', 'a-1006', 'a-1007', 'a-1008', 'a-1009', 'a-1010');
