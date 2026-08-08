-- CreateTable
CREATE TABLE `DevicePairing` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'CONSUMED') NOT NULL DEFAULT 'PENDING',
    `approvedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `approvedAt` DATETIME(3) NULL,
    `consumedAt` DATETIME(3) NULL,

    UNIQUE INDEX `DevicePairing_code_key`(`code`),
    INDEX `DevicePairing_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DevicePairing` ADD CONSTRAINT `DevicePairing_approvedByUserId_fkey` FOREIGN KEY (`approvedByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
