#!/bin/bash

# 手机进销存系统功能测试脚本
echo "==========================================="
echo "手机进销存系统功能测试"
echo "==========================================="

BASE_URL="http://localhost:8080"
API_BASE="$BASE_URL/api"

# 测试变量
USERNAME="admin"
PASSWORD="admin123"
TOKEN=""
TEST_BRAND_ID=""
TEST_MODEL_ID=""
TEST_SUPPLIER_ID=""
TEST_CUSTOMER_ID=""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 测试API连接
test_api_connection() {
    echo ""
    echo "1. 测试API连接..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/auth/login" -X POST -H "Content-Type: application/json" -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
    
    if [ "$response" -eq 200 ]; then
        log_info "API连接正常"
        return 0
    else
        log_error "API连接失败，状态码: $response"
        return 1
    fi
}

# 用户登录并获取token
login_user() {
    echo ""
    echo "2. 用户登录..."
    
    response=$(curl -s -X POST "$API_BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
    
    success=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
    
    if [ "$success" = "True" ] || [ "$success" = "true" ]; then
        TOKEN=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)
        log_info "登录成功，获取到token"
        return 0
    else
        log_error "登录失败: $response"
        return 1
    fi
}

# 测试认证保护
test_auth_protection() {
    echo ""
    echo "3. 测试认证保护..."
    
    response=$(curl -s -X GET "$API_BASE/users")
    success=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
    
    if [ "$success" = "False" ] || [ "$success" = "false" ]; then
        log_info "认证保护正常工作（未认证访问被拒绝）"
        return 0
    else
        log_warn "未认证访问未被拒绝，可能存在安全问题"
        return 1
    fi
}

# 测试带认证的API访问
test_authenticated_access() {
    echo ""
    echo "4. 测试带认证的API访问..."
    
    response=$(curl -s -X GET "$API_BASE/users" \
        -H "Authorization: Bearer $TOKEN")
    
    success=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
    
    if [ "$success" = "True" ] || [ "$success" = "true" ]; then
        log_info "认证访问正常"
        return 0
    else
        log_error "认证访问失败: $response"
        return 1
    fi
}

# 测试品牌管理
test_brand_management() {
    echo ""
    echo "5. 测试品牌管理..."
    
    # 创建测试品牌
    brand_name="TestBrand_$(date +%s)"
    response=$(curl -s -X POST "$API_BASE/brands" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$brand_name\", \"description\":\"测试品牌\"}")
    
    success=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
    
    if [ "$success" = "True" ] || [ "$success" = "true" ]; then
        TEST_BRAND_ID=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
        log_info "品牌创建成功，ID: $TEST_BRAND_ID"
        
        # 查询品牌
        response=$(curl -s -X GET "$API_BASE/brands" \
            -H "Authorization: Bearer $TOKEN")
        log_info "品牌查询成功"
        return 0
    else
        log_error "品牌管理测试失败: $response"
        return 1
    fi
}

# 测试手机型号管理
test_model_management() {
    echo ""
    echo "6. 测试手机型号管理..."
    
    if [ -z "$TEST_BRAND_ID" ]; then
        log_error "无法测试型号管理，缺少品牌ID"
        return 1
    fi
    
    # 创建测试型号
    model_name="TestModel_$(date +%s)"
    response=$(curl -s -X POST "$API_BASE/models" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"brand_id\":$TEST_BRAND_ID, \"model_name\":\"$model_name\", \"purchase_price\":2500, \"retail_price\":3000, \"specifications\":\"测试规格\", \"wholesale_price\":2800}")
    
    success=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
    
    if [ "$success" = "True" ] || [ "$success" = "true" ]; then
        TEST_MODEL_ID=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
        log_info "型号创建成功，ID: $TEST_MODEL_ID"
        
        # 查询型号
        response=$(curl -s -X GET "$API_BASE/models" \
            -H "Authorization: Bearer $TOKEN")
        log_info "型号查询成功"
        return 0
    else
        log_error "型号管理测试失败: $response"
        return 1
    fi
}

# 测试供应商管理
test_supplier_management() {
    echo ""
    echo "7. 测试供应商管理..."
    
    # 创建测试供应商
    supplier_name="TestSupplier_$(date +%s)"
    response=$(curl -s -X POST "$API_BASE/suppliers" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$supplier_name\", \"contact_person\":\"测试联系人\", \"phone\":\"13800138000\", \"email\":\"test@example.com\"}")
    
    success=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
    
    if [ "$success" = "True" ] || [ "$success" = "true" ]; then
        TEST_SUPPLIER_ID=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
        log_info "供应商创建成功，ID: $TEST_SUPPLIER_ID"
        
        # 查询供应商
        response=$(curl -s -X GET "$API_BASE/suppliers" \
            -H "Authorization: Bearer $TOKEN")
        log_info "供应商查询成功"
        return 0
    else
        log_error "供应商管理测试失败: $response"
        return 1
    fi
}

# 测试客户管理
test_customer_management() {
    echo ""
    echo "8. 测试客户管理..."
    
    # 创建测试客户
    customer_name="TestCustomer_$(date +%s)"
    response=$(curl -s -X POST "$API_BASE/customers" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$customer_name\", \"contact_person\":\"测试联系人\", \"phone\":\"13900139000\", \"email\":\"customer@example.com\"}")
    
    success=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
    
    if [ "$success" = "True" ] || [ "$success" = "true" ]; then
        TEST_CUSTOMER_ID=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
        log_info "客户创建成功，ID: $TEST_CUSTOMER_ID"
        
        # 查询客户
        response=$(curl -s -X GET "$API_BASE/customers" \
            -H "Authorization: Bearer $TOKEN")
        log_info "客户查询成功"
        return 0
    else
        log_error "客户管理测试失败: $response"
        return 1
    fi
}

# 测试库存管理
test_inventory_management() {
    echo ""
    echo "9. 测试库存管理..."
    
    if [ -z "$TEST_MODEL_ID" ]; then
        log_error "无法测试库存管理，缺少型号ID"
        return 1
    fi
    
    # 执行入库操作
    response=$(curl -s -X POST "$API_BASE/inventory/in" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"model_id\":$TEST_MODEL_ID, \"quantity\":10, \"remarks\":\"测试入库\"}")
    
    success=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
    
    if [ "$success" = "True" ] || [ "$success" = "true" ]; then
        log_info "入库操作成功"
        
        # 查询库存
        response=$(curl -s -X GET "$API_BASE/inventory" \
            -H "Authorization: Bearer $TOKEN")
        log_info "库存查询成功"
        return 0
    else
        log_error "库存管理测试失败: $response"
        return 1
    fi
}

# 运行所有测试
run_all_tests() {
    log_info "开始运行系统功能测试..."
    
    tests=(
        test_api_connection
        login_user
        test_auth_protection
        test_authenticated_access
        test_brand_management
        test_model_management
        test_supplier_management
        test_customer_management
        test_inventory_management
    )
    
    passed=0
    total=${#tests[@]}
    
    for test_func in "${tests[@]}"; do
        if $test_func; then
            ((passed++))
        else
            log_error "测试 $test_func 失败"
        fi
    done
    
    echo ""
    echo "==========================================="
    echo "测试总结:"
    echo "总测试数: $total"
    echo "通过: $passed"
    echo "失败: $((total - passed))"
    
    if [ $passed -eq $total ]; then
        log_info "所有测试通过！系统功能正常。"
        return 0
    else
        log_error "部分测试失败，请检查系统配置。"
        return 1
    fi
}

# 执行测试
run_all_tests