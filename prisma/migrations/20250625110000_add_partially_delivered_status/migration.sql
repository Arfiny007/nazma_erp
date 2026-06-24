-- AlterEnum: add Partially_Delivered to OrderStatus for challan-driven fulfillment
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'Partially_Delivered' AFTER 'Approved';
