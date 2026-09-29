<?php
namespace Controllers;

use PDO;

class ProductController {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    // 产品列表（后台管理用，返回全部含停用；附带关联授权数量）
    public function listAll() {
        $query = "SELECT p.*, (SELECT COUNT(*) FROM licenses l WHERE l.product_id = p.id) AS license_count
                  FROM products p ORDER BY p.id ASC";
        $stmt = $this->db->prepare($query);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            $row['id'] = (int)$row['id'];
            $row['is_enabled'] = (int)$row['is_enabled'];
            $row['license_count'] = (int)$row['license_count'];
        }
        echo json_encode($rows);
    }

    // 新增产品
    public function create() {
        $data = json_decode(file_get_contents("php://input"));

        if (empty($data->name) || trim($data->name) === '') {
            http_response_code(400);
            echo json_encode(["message" => "产品名称不能为空"]);
            return;
        }

        $name = trim($data->name);
        $version = isset($data->version) ? trim($data->version) : '';

        // 同名同版本防重复
        $check = $this->db->prepare("SELECT id FROM products WHERE name = :name AND version = :version LIMIT 1");
        $check->execute([':name' => $name, ':version' => $version]);
        if ($check->rowCount() > 0) {
            http_response_code(409);
            echo json_encode(["message" => "相同名称和版本的产品已存在"]);
            return;
        }

        $stmt = $this->db->prepare("INSERT INTO products (name, version, website_url, is_enabled) VALUES (:name, :version, :url, :enabled)");
        $ok = $stmt->execute([
            ':name' => $name,
            ':version' => $version,
            ':url' => !empty($data->website_url) ? trim($data->website_url) : null,
            ':enabled' => !empty($data->is_enabled) ? 1 : 0
        ]);

        if ($ok) {
            echo json_encode(["message" => "产品创建成功", "id" => (int)$this->db->lastInsertId()]);
        } else {
            http_response_code(500);
            echo json_encode(["message" => "产品创建失败"]);
        }
    }

    // 更新产品（名称/版本/官网链接/启用状态）
    public function update() {
        $data = json_decode(file_get_contents("php://input"));

        if (empty($data->id)) {
            http_response_code(400);
            echo json_encode(["message" => "缺少产品ID"]);
            return;
        }
        if (isset($data->name) && trim($data->name) === '') {
            http_response_code(400);
            echo json_encode(["message" => "产品名称不能为空"]);
            return;
        }

        $stmt = $this->db->prepare("UPDATE products SET name = :name, version = :version, website_url = :url, is_enabled = :enabled WHERE id = :id");
        $ok = $stmt->execute([
            ':name' => isset($data->name) ? trim($data->name) : '',
            ':version' => isset($data->version) ? trim($data->version) : '',
            ':url' => !empty($data->website_url) ? trim($data->website_url) : null,
            ':enabled' => !empty($data->is_enabled) ? 1 : 0,
            ':id' => $data->id
        ]);

        if ($ok) {
            echo json_encode(["message" => "产品已更新"]);
        } else {
            http_response_code(500);
            echo json_encode(["message" => "产品更新失败"]);
        }
    }

    // 删除产品（已被授权引用的产品禁止删除，建议改为停用）
    public function delete() {
        $data = json_decode(file_get_contents("php://input"));
        if (empty($data->id)) {
            http_response_code(400);
            echo json_encode(["message" => "缺少产品ID"]);
            return;
        }

        $check = $this->db->prepare("SELECT COUNT(*) FROM licenses WHERE product_id = :id");
        $check->execute([':id' => $data->id]);
        if ((int)$check->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(["message" => "该产品下仍有关联授权，无法删除，可选择停用"]);
            return;
        }

        $stmt = $this->db->prepare("DELETE FROM products WHERE id = :id");
        $stmt->execute([':id' => $data->id]);
        echo json_encode(["message" => "产品已删除"]);
    }
}
