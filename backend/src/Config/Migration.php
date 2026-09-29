<?php
namespace Config;

use PDO;

/**
 * 幂等数据库迁移：保证 products 表存在，且 licenses 表使用 product_id 关联产品。
 * 全新部署时 init.sql 已建好结构，此处迁移为空操作；
 * 旧库升级时自动补表、补字段并把历史 product_name 迁移为产品记录。
 */
class Migration {
    public static function run(PDO $db) {
        // 产品表
        $db->exec("CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL COMMENT '产品名称',
            version VARCHAR(50) NOT NULL DEFAULT '' COMMENT '版本',
            website VARCHAR(255) DEFAULT NULL COMMENT '官网链接',
            is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_products_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // 检查 licenses 表是否已有 product_id
        $cols = $db->query("SHOW COLUMNS FROM licenses")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('product_id', $cols, true)) {
            $db->exec("ALTER TABLE licenses ADD COLUMN product_id INT NULL DEFAULT NULL AFTER owner_name");

            // 把历史 product_name 迁移为产品记录
            $rows = $db->query("SELECT DISTINCT product_name FROM licenses WHERE product_name IS NOT NULL AND product_name <> ''")->fetchAll(PDO::FETCH_COLUMN);
            foreach ($rows as $pname) {
                $chk = $db->prepare("SELECT id FROM products WHERE name = :n LIMIT 1");
                $chk->execute([':n' => $pname]);
                $pid = $chk->fetchColumn();
                if (!$pid) {
                    $ins = $db->prepare("INSERT INTO products (name, version, is_active) VALUES (:n, '', 1)");
                    $ins->execute([':n' => $pname]);
                    $pid = $db->lastInsertId();
                }
                $upd = $db->prepare("UPDATE licenses SET product_id = :pid WHERE product_name = :pn AND product_id IS NULL");
                $upd->execute([':pid' => $pid, ':pn' => $pname]);
            }
        }
    }
}
