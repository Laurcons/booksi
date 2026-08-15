-- AlterTable
ALTER TABLE `Book` ADD COLUMN `format` VARCHAR(191) NULL,
    ADD COLUMN `publicationYear` INTEGER NULL,
    ADD COLUMN `publisher` VARCHAR(191) NULL,
    ADD COLUMN `volume` INTEGER NULL;
