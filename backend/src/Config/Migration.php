<?php
namespace Config;

use PDO;

/**
 * 轻量自动迁移：让已有数据卷无需重建即可获得产品管理相关结构。
 * init.sql 仅在首次初始化数据库时执行，此处保证老库平滑升级。
 */
class Migration {
    public static function run($db) {
        try {
            // 1. 产品表
            $db->exec("CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL COMMENT '产品名称',
                version VARCHAR(50) NOT NULL DEFAULT '' COMMENT '产品版本',
                website_url VARCHAR(255) DEFAULT NULL COMMENT '官网链接',
                is_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用(停用后不可新增授权)',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            // 2. licenses 增加 product_id 关联列
            $stmt = $db->query("SHOW COLUMNS FROM licenses LIKE 'product_id'");
            if ($stmt && $stmt->rowCount() === 0) {
                $db->exec("ALTER TABLE licenses ADD COLUMN product_id INT NULL AFTER owner_name, ADD INDEX idx_product (product_id)");

                // 3. 旧库存在手写 product_name 列时：抽取为产品记录并回填关联
                $legacy = $db->query("SHOW COLUMNS FROM licenses LIKE 'product_name'");
                if ($legacy && $legacy->rowCount() > 0) {
                    $db->exec("INSERT INTO products (name, version, is_enabled)
                               SELECT DISTINCT product_name, '', TRUE FROM licenses
                               WHERE product_name IS NOT NULL AND product_name <> ''
                                 AND product_name NOT IN (SELECT name FROM products)");
                    $db->exec("UPDATE licenses l JOIN products p ON l.product_name = p.name
                               SET l.product_id = p.id WHERE l.product_id IS NULL");
                    // 放开旧列约束，避免新插入(不再写该列)在严格模式下报错
                    $db->exec("ALTER TABLE licenses MODIFY product_name VARCHAR(100) NULL DEFAULT NULL");
                }
            }
        } catch (\Exception $e) {
            // 迁移失败不阻断服务，仅记录日志
            error_log("Migration error: " . $e->getMessage());
        }
    }
}
