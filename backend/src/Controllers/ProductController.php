<?php
namespace Controllers;

use Config\Database;
use PDO;

class ProductController {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    // 后台：产品列表（含启用/停用）
    public function list() {
        $stmt = $this->db->query("SELECT * FROM products ORDER BY id DESC");
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // 前台/新增授权用：仅启用的产品
    public function activeList() {
        $stmt = $this->db->prepare("SELECT id, name, version, website FROM products WHERE is_active = 1 ORDER BY id ASC");
        $stmt->execute();
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // 后台：新增产品
    public function create() {
        $data = json_decode(file_get_contents("php://input"));
        if (!isset($data->name) || trim($data->name) === '') {
            http_response_code(400);
            echo json_encode(["message" => "产品名称不能为空"]);
            return;
        }

        $name = trim($data->name);
        $version = isset($data->version) ? trim($data->version) : '';
        $website = isset($data->website) ? trim($data->website) : null;
        $isActive = isset($data->is_active) ? (bool)$data->is_active : true;

        // 同名产品校验
        $chk = $this->db->prepare("SELECT id FROM products WHERE name = :n LIMIT 1");
        $chk->execute([':n' => $name]);
        if ($chk->rowCount() > 0) {
            http_response_code(409);
            echo json_encode(["message" => "产品名称已存在"]);
            return;
        }

        $stmt = $this->db->prepare("INSERT INTO products (name, version, website, is_active) VALUES (:n, :v, :w, :a)");
        $stmt->execute([':n' => $name, ':v' => $version, ':w' => $website, ':a' => $isActive]);

        echo json_encode(["message" => "产品创建成功", "id" => (int)$this->db->lastInsertId()]);
    }

    // 后台：更新产品
    public function update() {
        $data = json_decode(file_get_contents("php://input"));
        if (!isset($data->id)) {
            http_response_code(400);
            echo json_encode(["message" => "缺少产品ID"]);
            return;
        }

        $fields = [];
        $params = [':id' => $data->id];

        if (isset($data->name)) {
            $name = trim($data->name);
            if ($name === '') {
                http_response_code(400);
                echo json_encode(["message" => "产品名称不能为空"]);
                return;
            }
            // 同名排除自身
            $chk = $this->db->prepare("SELECT id FROM products WHERE name = :n AND id <> :id LIMIT 1");
            $chk->execute([':n' => $name, ':id' => $data->id]);
            if ($chk->rowCount() > 0) {
                http_response_code(409);
                echo json_encode(["message" => "产品名称已存在"]);
                return;
            }
            $fields[] = 'name = :name';
            $params[':name'] = $name;
        }
        if (isset($data->version)) {
            $fields[] = 'version = :version';
            $params[':version'] = trim($data->version);
        }
        if (isset($data->website)) {
            $fields[] = 'website = :website';
            $params[':website'] = trim($data->website) ?: null;
        }
        if (isset($data->is_active)) {
            $fields[] = 'is_active = :is_active';
            $params[':is_active'] = (bool)$data->is_active;
        }

        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(["message" => "没有需要更新的字段"]);
            return;
        }

        $sql = "UPDATE products SET " . implode(', ', $fields) . " WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        echo json_encode(["message" => "产品更新成功"]);
    }

    // 后台：切换启用/停用
    public function toggle() {
        $data = json_decode(file_get_contents("php://input"));
        if (!isset($data->id)) {
            http_response_code(400);
            echo json_encode(["message" => "缺少产品ID"]);
            return;
        }
        $stmt = $this->db->prepare("UPDATE products SET is_active = NOT is_active WHERE id = :id");
        $stmt->execute([':id' => $data->id]);
        echo json_encode(["message" => "状态已切换"]);
    }

    // 后台：删除产品（存在授权时拒绝）
    public function delete() {
        $data = json_decode(file_get_contents("php://input"));
        if (!isset($data->id)) {
            http_response_code(400);
            echo json_encode(["message" => "缺少产品ID"]);
            return;
        }

        $chk = $this->db->prepare("SELECT COUNT(*) FROM licenses WHERE product_id = :id");
        $chk->execute([':id' => $data->id]);
        $count = (int)$chk->fetchColumn();
        if ($count > 0) {
            http_response_code(409);
            echo json_encode(["message" => "该产品下存在 {$count} 条授权，无法删除，请改为停用"]);
            return;
        }

        $stmt = $this->db->prepare("DELETE FROM products WHERE id = :id");
        $stmt->execute([':id' => $data->id]);
        echo json_encode(["message" => "产品已删除"]);
    }
}
