<?php
namespace Controllers;

use Config\Database;
use PDO;

class LicenseController {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    // Public Query
    public function query() {
        if (!isset($_GET['qq']) || !isset($_GET['owner'])) {
            http_response_code(400);
            echo json_encode(["message" => "Missing parameters"]);
            return;
        }

        $qq = $_GET['qq'];
        $owner = $_GET['owner'];

        $query = "SELECT l.*, p.name AS product_name, p.version AS product_version
                  FROM licenses l
                  LEFT JOIN products p ON l.product_id = p.id
                  WHERE l.qq = :qq AND l.owner_name = :owner LIMIT 1";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(":qq", $qq);
        $stmt->bindParam(":owner", $owner);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            // Check if expired logic? The prompt says just show info.
            // But prompt also lists reasons for failure: "1.授权开通不足60分钟内" (implies < 60 mins from creation?) - this is weird, maybe it means 'just created'? or 'not synced'?
            // Usually "Authorization not found" reasons are generic boilerplate.
            // Let's just return the data.

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "data" => [
                    "qq" => $row['qq'],
                    "owner" => $row['owner_name'],
                    "product" => $row['product_name'] ?: '未知产品',
                    "product_version" => $row['product_version'] ?: '',
                    "upline" => $row['upline'],
                    "expiration" => $row['expiration_date'],
                    "created_at" => $row['created_at']
                ]
            ]);
        } else {
            // Failure with specific message
            http_response_code(404);
            echo json_encode([
                "status" => "error",
                "message" => "暂未查询到您的授权信息 请查证后再次查询！",
                "reasons" => [
                    "1.授权开通不足60分钟内",
                    "2.未购买正版授权，可能是盗版程序授权",
                    "3.恭喜你，被圈钱了！"
                ]
            ]);
        }
    }

    // Admin: List All
    public function listAll() {
        $query = "SELECT l.*, p.name AS product_name, p.version AS product_version
                  FROM licenses l
                  LEFT JOIN products p ON l.product_id = p.id
                  ORDER BY l.created_at DESC";
        $stmt = $this->db->prepare($query);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($rows);
    }

    // Admin: Create
    public function create() {
        $data = json_decode(file_get_contents("php://input"));
        // Need: qq, owner_name, product_id, upline, expiration_date
        if (empty($data->qq) || empty($data->owner_name) || empty($data->product_id) || empty($data->expiration_date)) {
            http_response_code(400);
            echo json_encode(["message" => "请填写完整授权信息并选择所属产品"]);
            return;
        }

        // 校验产品存在且处于启用状态（停用产品不可新增授权）
        $pstmt = $this->db->prepare("SELECT id, is_enabled FROM products WHERE id = :id LIMIT 1");
        $pstmt->execute([':id' => $data->product_id]);
        $product = $pstmt->fetch(PDO::FETCH_ASSOC);
        if (!$product) {
            http_response_code(400);
            echo json_encode(["message" => "所选产品不存在"]);
            return;
        }
        if (!(int)$product['is_enabled']) {
            http_response_code(400);
            echo json_encode(["message" => "该产品已停用，无法新增授权"]);
            return;
        }

        $query = "INSERT INTO licenses (qq, owner_name, product_id, upline, expiration_date) VALUES (:qq, :owner, :product_id, :upline, :exp)";
        $stmt = $this->db->prepare($query);

        $params = [
            ":qq" => $data->qq,
            ":owner" => $data->owner_name,
            ":product_id" => $data->product_id,
            ":upline" => isset($data->upline) && $data->upline !== '' ? $data->upline : '官方',
            ":exp" => $data->expiration_date
        ];

        if($stmt->execute($params)) {
             echo json_encode(["message" => "Created successfully"]);
        } else {
             http_response_code(500);
             echo json_encode(["message" => "Create failed"]);
        }
    }
    
    // Admin: Delete
    public function delete() {
         $data = json_decode(file_get_contents("php://input"));
         if(!isset($data->id)) { return; }
         $query = "DELETE FROM licenses WHERE id = :id";
         $stmt = $this->db->prepare($query);
         $stmt->bindParam(":id", $data->id);
         $stmt->execute();
         echo json_encode(["message" => "Deleted"]);
    }

    // Update Flow: Step 1 - Send Code
    public function sendVerificationCode() {
        $data = json_decode(file_get_contents("php://input"));
        $qq = $data->qq;
        $email = $qq . "@qq.com";
        
        $code = rand(100000, 999999);
        
        // Save code
        $stmt = $this->db->prepare("INSERT INTO verification_codes (type, identifier, code, expires_at) VALUES ('update_license', :email, :code, DATE_ADD(NOW(), INTERVAL 10 MINUTE))");
        $stmt->execute([':email' => $email, ':code' => $code]);
        
        // Real Email Sending via PHPMailer
        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        try {
            //Server settings
            $mail->SMTPDebug = 2; // Enable verbose debug output
            $mail->Debugoutput = 'error_log'; // Output to stderr
            $mail->isSMTP();
            $mail->Host       = 'smtp.163.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = 'yuwangifeng@163.com';
            $mail->Password   = 'LRZMA358wePVGa8F'; 
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
            $mail->Port       = 465;
            $mail->CharSet    = 'UTF-8';

            // Allow self-signed certs (matches Node.js permissive behavior)
            $mail->SMTPOptions = array(
                'ssl' => array(
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                    'allow_self_signed' => true
                )
            );

            //Recipients - Name removed to match Node example exactly
            $mail->setFrom('yuwangifeng@163.com');
            $mail->addAddress($email);
            
            // Set HELO to localhost to avoid Docker container ID rejection
            $mail->Hostname = 'localhost';

            //Content
            $mail->isHTML(true);
            $mail->Subject = '【授权系统】验证码';
            $mail->Body    = "您的验证码是 <b>$code</b>，请在10分钟内完成验证。<br>如非本人操作请忽略。";

            $mail->send();
            echo json_encode(["message" => "验证码已发送至QQ邮箱"]);
        } catch (\Exception $e) {
            // Fallback for demo/dev if SMTP fails
            error_log("SMTP Error: {$mail->ErrorInfo}");
            echo json_encode([
                 "message" => "邮件发送失败 (转为模拟模式)", 
                 "mock_code" => $code,
                 "debug_error" => $mail->ErrorInfo
            ]);
        }
    }

    // Update Flow: Step 2 - Verify & Update
    public function update() {
        $data = json_decode(file_get_contents("php://input"));
        // Expect: qq, code, new_owner, new_product...
        
        $email = $data->qq . "@qq.com";
        $code = $data->code;
        
        // Verify Code
        $stmt = $this->db->prepare("SELECT * FROM verification_codes WHERE identifier=:email AND code=:code AND expires_at > NOW() ORDER BY id DESC LIMIT 1");
        $stmt->execute([':email' => $email, ':code' => $code]);
        
        if ($stmt->rowCount() == 0) {
            http_response_code(400);
            echo json_encode(["message" => "Invalid or expired code"]);
            return;
        }
        
        // Update License
        // For demo, assume we update the owner name for this QQ
        $updateQ = "UPDATE licenses SET owner_name = :new_owner WHERE qq = :qq";
        $ustmt = $this->db->prepare($updateQ);
        $ustmt->execute([':new_owner' => $data->owner_name, ':qq' => $data->qq]); // assuming we update owner
        
        echo json_encode(["message" => "Update successful"]);
    }
}
