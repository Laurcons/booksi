-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `googleId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `avatarUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_googleId_key`(`googleId`),
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Book` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `author` VARCHAR(191) NULL,
    `isbn` VARCHAR(191) NULL,
    `totalPages` INTEGER NULL,
    `genre` ENUM('FICTION', 'SCIFI', 'FANTASY', 'THRILLER', 'ROMANCE', 'HISTORICAL', 'MEMOIR', 'NONFICTION', 'SELF_HELP', 'BUSINESS', 'SCIENCE', 'PHILOSOPHY', 'PSYCHOLOGY', 'POETRY', 'COMICS_MANGA', 'CHILDREN_YA', 'OTHER') NULL,
    `olEditionKey` VARCHAR(191) NULL,
    `status` ENUM('WISHLIST', 'PURCHASED', 'READING', 'FINISHED', 'ABANDONED') NOT NULL DEFAULT 'WISHLIST',
    `favorite` BOOLEAN NOT NULL DEFAULT false,
    `pagesRead` INTEGER NOT NULL DEFAULT 0,
    `rating` INTEGER NULL,
    `estimatedPrice` DECIMAL(10, 2) NULL,
    `paidPrice` DECIMAL(10, 2) NULL,
    `purchasedOn` DATE NULL,
    `startedOn` DATE NULL,
    `finishedOn` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `manuallyEditedFields` JSON NULL,

    INDEX `Book_userId_status_idx`(`userId`, `status`),
    INDEX `Book_userId_finishedOn_idx`(`userId`, `finishedOn`),
    INDEX `Book_userId_purchasedOn_idx`(`userId`, `purchasedOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cover` (
    `bookId` VARCHAR(191) NOT NULL,
    `data` LONGBLOB NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `source` ENUM('OPEN_LIBRARY', 'UPLOAD') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`bookId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Settings` (
    `userId` VARCHAR(191) NOT NULL,
    `monthlyBudget` DECIMAL(10, 2) NULL,
    `yearlyBudget` DECIMAL(10, 2) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'RON',

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Book` ADD CONSTRAINT `Book_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cover` ADD CONSTRAINT `Cover_bookId_fkey` FOREIGN KEY (`bookId`) REFERENCES `Book`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Settings` ADD CONSTRAINT `Settings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
