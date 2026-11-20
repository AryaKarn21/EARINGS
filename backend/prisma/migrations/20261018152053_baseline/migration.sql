-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AuthTokenType" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "public"."DeliveryBoyStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."DeliveryStatus" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."NotificationCategory" AS ENUM ('NEW_ORDER', 'PAYMENT_CONFIRMED', 'SELLER_ORDER_UPDATE', 'DELIVERY_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'RETURN_REFUND_REQUEST', 'NEW_REVIEW', 'NEW_SERVICE_SUBMISSION', 'SERVICE_BOOKING', 'SYSTEM_ALERT');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."ProductApprovalStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."ReviewModerationStatus" AS ENUM ('Approved', 'Flagged', 'Rejected');

-- CreateEnum
CREATE TYPE "public"."SellerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."ServiceBookingStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ServiceVerificationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED_VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."TryOnEventType" AS ENUM ('opened', 'started', 'product_changed', 'screenshot', 'wishlist', 'add_to_cart', 'checkout', 'purchase');

-- CreateEnum
CREATE TYPE "public"."TryOnMode" AS ENUM ('camera', 'upload');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'PRODUCT_MANAGER', 'ORDER_MANAGER', 'CUSTOMER_SUPPORT', 'CUSTOMER', 'SELLER', 'DELIVERY_BOY');

-- CreateTable
CREATE TABLE "public"."AIRecommendation" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL DEFAULT 'guest',
    "productId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "prefs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reasons" JSONB,

    CONSTRAINT "AIRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "actorOwnerKey" TEXT NOT NULL,
    "actorRole" "public"."UserRole" NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."AuthTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Banner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "linkUrl" TEXT,
    "imageUrl" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Cart" (
    "ownerKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("ownerKey")
);

-- CreateTable
CREATE TABLE "public"."CartItem" (
    "id" TEXT NOT NULL,
    "cartOwnerKey" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productType" TEXT NOT NULL DEFAULT 'earrings',

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliveryAssignment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "deliveryPersonId" TEXT NOT NULL,
    "assignedById" TEXT,
    "status" "public"."DeliveryStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "notes" TEXT,
    "otpVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliveryProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "assignedArea" TEXT,
    "vehicleType" TEXT,
    "idDocumentUrl" TEXT,
    "status" "public"."DeliveryBoyStatus" NOT NULL DEFAULT 'PENDING',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliveryProof" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "deliveryPersonId" TEXT NOT NULL,
    "recipientName" TEXT,
    "otpUsed" TEXT,
    "photoUrl" TEXT,
    "signatureUrl" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "cashCollected" DOUBLE PRECISION,
    "isPaymentConfirmed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FaceShapeDetection" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL DEFAULT 'guest',
    "faceShape" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'mediapipe-client',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceShapeDetection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImageAsset" (
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "targetRole" "public"."UserRole",
    "category" "public"."NotificationCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shipping" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION,
    "shippingAddress" JSONB,
    "paymentMethod" TEXT,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tax" DOUBLE PRECISION DEFAULT 0,
    "assignedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "deliveryNotes" TEXT,
    "deliveryOtp" TEXT,
    "deliveryPersonId" TEXT,
    "deliveryStatus" "public"."DeliveryStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "isReturnRequested" BOOLEAN NOT NULL DEFAULT false,
    "orderNumber" TEXT,
    "paymentStatus" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "returnReason" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT,
    "price" DOUBLE PRECISION,
    "qty" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfillmentStatus" TEXT DEFAULT 'UNFULFILLED',
    "sellerId" TEXT,
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "previousStatus" "public"."OrderStatus",
    "newStatus" "public"."OrderStatus" NOT NULL,
    "deliveryStatus" "public"."DeliveryStatus",
    "paymentStatus" "public"."PaymentStatus",
    "changedByKey" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "material" TEXT,
    "color" TEXT,
    "stone" TEXT DEFAULT '—',
    "style" TEXT,
    "occasion" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price" DOUBLE PRECISION NOT NULL,
    "originalPrice" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.5,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 10,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kind" TEXT NOT NULL DEFAULT 'stud',
    "faceShapeMatch" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "dimensions" TEXT NOT NULL DEFAULT '2.2cm x 0.8cm',
    "weight" TEXT NOT NULL DEFAULT '3.1g',
    "tryOnAsset" JSONB NOT NULL DEFAULT '{"left": null, "front": null, "right": null, "transparent": null}',
    "defaultScale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "defaultOffsetX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultOffsetY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isEditorsPick" BOOLEAN NOT NULL DEFAULT false,
    "productType" TEXT NOT NULL DEFAULT 'earrings',
    "searchVector" tsvector,
    "trendScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trendScoreBreakdown" JSONB,
    "trendScoreComputedAt" TIMESTAMP(3),
    "trendScorePrevious" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "approvalStatus" "public"."ProductApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sellerId" TEXT,
    "sku" TEXT,
    "primaryImageIndex" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductSearchImpression" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSearchImpression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductView" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL DEFAULT 'guest',
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Review" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moderationStatus" "public"."ReviewModerationStatus" NOT NULL DEFAULT 'Approved',
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
    "orderId" TEXT,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewHelpfulVote" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewHelpfulVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewReport" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RevokedToken" (
    "jti" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedToken_pkey" PRIMARY KEY ("jti")
);

-- CreateTable
CREATE TABLE "public"."SellerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "status" "public"."SellerStatus" NOT NULL DEFAULT 'PENDING',
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "payoutDetails" JSONB,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Service" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coverImage" TEXT,
    "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price" DOUBLE PRECISION NOT NULL,
    "pricingMethod" TEXT NOT NULL DEFAULT 'fixed',
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "serviceArea" TEXT,
    "bookingInfo" TEXT,
    "terms" TEXT,
    "status" "public"."ServiceVerificationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "rejectionReason" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceBooking" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "customerKey" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "timeSlot" TEXT,
    "status" "public"."ServiceBookingStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "contactPhone" TEXT,
    "customerAddress" TEXT,
    "price" DOUBLE PRECISION,
    "paymentStatus" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceDocument" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceReview" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "bookingId" TEXT,
    "ownerKey" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."TryOnEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "ownerKey" TEXT NOT NULL DEFAULT 'guest',
    "productId" TEXT NOT NULL,
    "eventType" "public"."TryOnEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TryOnEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TryOnSession" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL DEFAULT 'guest',
    "productId" TEXT NOT NULL,
    "mode" "public"."TryOnMode" NOT NULL,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TryOnSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "googleId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Wishlist" (
    "ownerKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("ownerKey")
);

-- CreateTable
CREATE TABLE "public"."WishlistItem" (
    "id" TEXT NOT NULL,
    "wishlistOwnerKey" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIRecommendation_productId_idx" ON "public"."AIRecommendation"("productId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_actorOwnerKey_idx" ON "public"."AuditLog"("actorOwnerKey" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "public"."AuditLog"("targetType" ASC, "targetId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "public"."AuthToken"("tokenHash" ASC);

-- CreateIndex
CREATE INDEX "CartItem_cartOwnerKey_idx" ON "public"."CartItem"("cartOwnerKey" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartOwnerKey_productId_key" ON "public"."CartItem"("cartOwnerKey" ASC, "productId" ASC);

-- CreateIndex
CREATE INDEX "CartItem_productId_createdAt_idx" ON "public"."CartItem"("productId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Category_productType_idx" ON "public"."Category"("productType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "public"."Category"("slug" ASC);

-- CreateIndex
CREATE INDEX "DeliveryAssignment_deliveryPersonId_idx" ON "public"."DeliveryAssignment"("deliveryPersonId" ASC);

-- CreateIndex
CREATE INDEX "DeliveryAssignment_orderId_idx" ON "public"."DeliveryAssignment"("orderId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryProfile_userId_key" ON "public"."DeliveryProfile"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryProof_orderId_key" ON "public"."DeliveryProof"("orderId" ASC);

-- CreateIndex
CREATE INDEX "FaceShapeDetection_createdAt_idx" ON "public"."FaceShapeDetection"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "FaceShapeDetection_ownerKey_idx" ON "public"."FaceShapeDetection"("ownerKey" ASC);

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "public"."Notification"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "public"."Notification"("isRead" ASC);

-- CreateIndex
CREATE INDEX "Notification_targetRole_idx" ON "public"."Notification"("targetRole" ASC);

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "public"."Notification"("userId" ASC);

-- CreateIndex
CREATE INDEX "Order_deliveryPersonId_idx" ON "public"."Order"("deliveryPersonId" ASC);

-- CreateIndex
CREATE INDEX "Order_deliveryStatus_idx" ON "public"."Order"("deliveryStatus" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "public"."Order"("orderNumber" ASC);

-- CreateIndex
CREATE INDEX "Order_ownerKey_idx" ON "public"."Order"("ownerKey" ASC);

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "public"."Order"("paymentStatus" ASC);

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "public"."Order"("status" ASC);

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "public"."OrderItem"("orderId" ASC);

-- CreateIndex
CREATE INDEX "OrderItem_productId_createdAt_idx" ON "public"."OrderItem"("productId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "OrderItem_sellerId_idx" ON "public"."OrderItem"("sellerId" ASC);

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_idx" ON "public"."OrderStatusHistory"("orderId" ASC);

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "public"."Product"("category" ASC);

-- CreateIndex
CREATE INDEX "Product_price_idx" ON "public"."Product"("price" ASC);

-- CreateIndex
CREATE INDEX "Product_productType_category_idx" ON "public"."Product"("productType" ASC, "category" ASC);

-- CreateIndex
CREATE INDEX "Product_productType_idx" ON "public"."Product"("productType" ASC);

-- CreateIndex
CREATE INDEX "Product_rating_idx" ON "public"."Product"("rating" ASC);

-- CreateIndex
CREATE INDEX "ProductSearchImpression_productId_createdAt_idx" ON "public"."ProductSearchImpression"("productId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ProductView_productId_createdAt_idx" ON "public"."ProductView"("productId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ProductView_productId_idx" ON "public"."ProductView"("productId" ASC);

-- CreateIndex
CREATE INDEX "Review_orderId_idx" ON "public"."Review"("orderId" ASC);

-- CreateIndex
CREATE INDEX "Review_productId_createdAt_idx" ON "public"."Review"("productId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Review_productId_idx" ON "public"."Review"("productId" ASC);

-- CreateIndex
CREATE INDEX "Review_productId_moderationStatus_idx" ON "public"."Review"("productId" ASC, "moderationStatus" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Review_productId_ownerKey_key" ON "public"."Review"("productId" ASC, "ownerKey" ASC);

-- CreateIndex
CREATE INDEX "ReviewHelpfulVote_reviewId_idx" ON "public"."ReviewHelpfulVote"("reviewId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewHelpfulVote_reviewId_ownerKey_key" ON "public"."ReviewHelpfulVote"("reviewId" ASC, "ownerKey" ASC);

-- CreateIndex
CREATE INDEX "ReviewReport_reviewId_idx" ON "public"."ReviewReport"("reviewId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReport_reviewId_ownerKey_key" ON "public"."ReviewReport"("reviewId" ASC, "ownerKey" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SellerProfile_slug_key" ON "public"."SellerProfile"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SellerProfile_userId_key" ON "public"."SellerProfile"("userId" ASC);

-- CreateIndex
CREATE INDEX "Service_category_idx" ON "public"."Service"("category" ASC);

-- CreateIndex
CREATE INDEX "Service_providerId_idx" ON "public"."Service"("providerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "public"."Service"("slug" ASC);

-- CreateIndex
CREATE INDEX "Service_status_idx" ON "public"."Service"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceBooking_bookingNumber_key" ON "public"."ServiceBooking"("bookingNumber" ASC);

-- CreateIndex
CREATE INDEX "ServiceBooking_customerKey_idx" ON "public"."ServiceBooking"("customerKey" ASC);

-- CreateIndex
CREATE INDEX "ServiceBooking_serviceId_idx" ON "public"."ServiceBooking"("serviceId" ASC);

-- CreateIndex
CREATE INDEX "ServiceBooking_status_idx" ON "public"."ServiceBooking"("status" ASC);

-- CreateIndex
CREATE INDEX "ServiceDocument_serviceId_idx" ON "public"."ServiceDocument"("serviceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceReview_bookingId_key" ON "public"."ServiceReview"("bookingId" ASC);

-- CreateIndex
CREATE INDEX "ServiceReview_ownerKey_idx" ON "public"."ServiceReview"("ownerKey" ASC);

-- CreateIndex
CREATE INDEX "ServiceReview_serviceId_idx" ON "public"."ServiceReview"("serviceId" ASC);

-- CreateIndex
CREATE INDEX "TryOnEvent_createdAt_idx" ON "public"."TryOnEvent"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "TryOnEvent_productId_eventType_idx" ON "public"."TryOnEvent"("productId" ASC, "eventType" ASC);

-- CreateIndex
CREATE INDEX "TryOnEvent_sessionId_idx" ON "public"."TryOnEvent"("sessionId" ASC);

-- CreateIndex
CREATE INDEX "TryOnSession_productId_createdAt_idx" ON "public"."TryOnSession"("productId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "TryOnSession_productId_idx" ON "public"."TryOnSession"("productId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "public"."User"("googleId" ASC);

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role" ASC);

-- CreateIndex
CREATE INDEX "WishlistItem_productId_createdAt_idx" ON "public"."WishlistItem"("productId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "WishlistItem_wishlistOwnerKey_idx" ON "public"."WishlistItem"("wishlistOwnerKey" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_wishlistOwnerKey_productId_key" ON "public"."WishlistItem"("wishlistOwnerKey" ASC, "productId" ASC);

-- AddForeignKey
ALTER TABLE "public"."AIRecommendation" ADD CONSTRAINT "AIRecommendation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartItem" ADD CONSTRAINT "CartItem_cartOwnerKey_fkey" FOREIGN KEY ("cartOwnerKey") REFERENCES "public"."Cart"("ownerKey") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_deliveryPersonId_fkey" FOREIGN KEY ("deliveryPersonId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryProfile" ADD CONSTRAINT "DeliveryProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryProof" ADD CONSTRAINT "DeliveryProof_deliveryPersonId_fkey" FOREIGN KEY ("deliveryPersonId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryProof" ADD CONSTRAINT "DeliveryProof_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_deliveryPersonId_fkey" FOREIGN KEY ("deliveryPersonId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductSearchImpression" ADD CONSTRAINT "ProductSearchImpression_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductView" ADD CONSTRAINT "ProductView_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewHelpfulVote" ADD CONSTRAINT "ReviewHelpfulVote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewReport" ADD CONSTRAINT "ReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SellerProfile" ADD CONSTRAINT "SellerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceBooking" ADD CONSTRAINT "ServiceBooking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceDocument" ADD CONSTRAINT "ServiceDocument_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceReview" ADD CONSTRAINT "ServiceReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."ServiceBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceReview" ADD CONSTRAINT "ServiceReview_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TryOnEvent" ADD CONSTRAINT "TryOnEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TryOnEvent" ADD CONSTRAINT "TryOnEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."TryOnSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TryOnSession" ADD CONSTRAINT "TryOnSession_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WishlistItem" ADD CONSTRAINT "WishlistItem_wishlistOwnerKey_fkey" FOREIGN KEY ("wishlistOwnerKey") REFERENCES "public"."Wishlist"("ownerKey") ON DELETE CASCADE ON UPDATE CASCADE;

