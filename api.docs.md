# CHALO BE — API DOCS (LATEST)

Tai lieu nay duoc cap nhat theo code backend hien tai.

## 1) Cau hinh chung

- Base URL local: `http://localhost:8080`
- Global prefix: `/api`
- Full API base: `http://localhost:8080/api`
- Swagger (non-production): `http://localhost:8080/api/docs`

### Response thanh cong (global interceptor)

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

---

## 2) Auth & Roles

- Header REST: `Authorization: Bearer <accessToken>`
- SSE EventSource: `GET /api/order/events?token=<accessToken>`
- Roles:
  - `ADMIN`
  - `MODERATOR`

---

## 3) Auth APIs

### POST `/api/auth/login` (Public)

- Body:

```json
{
  "username": "admin",
  "password": "123456"
}
```

- Response `data`:

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": 1,
    "username": "admin",
    "fullName": "Nguyen Van Admin",
    "avatar": null,
    "role": "ADMIN",
    "permission": ["menu:write", "table:write", "order:write", "staff:write"]
  }
}
```

> Luu y: field ten la `permission` (khong co chu 's').

---

### POST `/api/auth/refresh-token` (Public)

- Body:

```json
{ "refreshToken": "eyJ..." }
```

- Response `data`:

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

---

### POST `/api/auth/logout` (Bearer)

- Body: khong can.
- Response `data`: `null`

---

### GET `/api/auth/me` (Bearer)

- Response `data`:

```json
{
  "id": 1,
  "username": "admin",
  "fullName": "Nguyen Van Admin",
  "avatar": null,
  "role": "ADMIN",
  "permission": ["menu:write", "table:write", "order:write", "staff:write"]
}
```

---

## 4) User APIs

> Tat ca endpoint can Bearer token.

### GET `/api/user/page` (ADMIN)

- Query (optional):
  - `pageNo` (default 1)
  - `pageSize` (default 10)
  - `keyword`
  - `role` = `ADMIN | MODERATOR`
  - `isActive` = `true | false`
- Response `data`:

```json
{
  "list": [
    {
      "id": 2,
      "username": "staff01",
      "fullName": "Tran Thi Nhan Vien",
      "avatar": null,
      "role": "MODERATOR",
      "isActive": true,
      "createdAt": "2026-05-01T00:00:00.000Z"
    }
  ],
  "total": 1
}
```

---

### POST `/api/user/create` (ADMIN)

- Body:

```json
{
  "username": "staff02",
  "password": "123456",
  "fullName": "Le Van Nhan Vien",
  "role": "MODERATOR",
  "isActive": true
}
```

---

### PUT `/api/user/update` (ADMIN)

- Body:

```json
{
  "id": 2,
  "fullName": "Le Van Cap Nhat",
  "avatar": null,
  "role": "MODERATOR",
  "isActive": true
}
```

---

### PUT `/api/user/change-password` (Bearer)

- Body:

```json
{
  "id": 2,
  "oldPassword": "oldpass123",
  "newPassword": "newpass123"
}
```

- Quy tac phan quyen:

| Nguoi goi   | doi cho ai                       | oldPassword    |
| ----------- | -------------------------------- | -------------- |
| `ADMIN`     | bat ky user nao                  | Khong bat buoc |
| `MODERATOR` | chinh minh (`id` == requesterId) | Bat buoc       |
| `MODERATOR` | nguoi khac                       | 403 Forbidden  |

---

### DELETE `/api/user/delete` (ADMIN)

- Query: `id` (required, number)
- Rule: Khong the xoa chinh minh.

---

## 5) Category APIs

### GET `/api/menu/category/list` (Public)

- Response `data`:

```json
[
  {
    "id": "uuid",
    "name": "Tra sua",
    "description": "Cac loai tra sua",
    "imageUrl": null,
    "sortOrder": 1,
    "isActive": true,
    "productCount": 5,
    "createdAt": "2026-05-01T00:00:00.000Z"
  }
]
```

> `productCount`: so san pham `isActive=true` thuoc danh muc.

---

### GET `/api/menu/category/simple-list` (Public)

- Response `data`: `[{ "id": "uuid", "name": "Tra sua" }]`

---

### GET `/api/menu/category/detail` (Bearer)

- Query: `id` (required, UUID)
- Response `data`: Tuong tu `list` nhung tra 1 object.

---

### POST `/api/menu/category/create` (ADMIN)

```json
{
  "name": "Tra sua",
  "description": "Cac loai tra sua",
  "imageUrl": null,
  "sortOrder": 1,
  "isActive": true
}
```

---

### PUT `/api/menu/category/update` (ADMIN)

```json
{
  "id": "uuid",
  "name": "Tra sua updated",
  "description": "Mo ta moi",
  "imageUrl": null,
  "sortOrder": 1,
  "isActive": true
}
```

---

### DELETE `/api/menu/category/delete` (ADMIN)

- Query: `id` (required, UUID)
- Rule: Khong the xoa danh muc dang co san pham.

---

## 6) Product APIs

### GET `/api/menu/product/list` (Public)

- Muc dich: Menu public cho khach QR (isActive=true, status=AVAILABLE).
- Response `data`:

```json
[
  {
    "id": "uuid",
    "categoryId": "uuid",
    "categoryName": "Tra sua",
    "name": "Tra sua tay bac",
    "description": "Tra sua truyen thong",
    "imageUrl": "http://localhost:8080/uploads/xxx.jpg",
    "price": 35000,
    "status": "AVAILABLE",
    "isActive": true,
    "sortOrder": 1,
    "prepTime": 3,
    "createdAt": "2026-05-01T00:00:00.000Z"
  }
]
```

---

### GET `/api/menu/product/page` (Bearer)

- Query (optional):
  - `pageNo` (default 1), `pageSize` (default 10)
  - `name`, `categoryId`
  - `status` = `AVAILABLE | UNAVAILABLE | OUT_OF_STOCK`
  - `isActive` = `true | false`
- Response `data`: `{ "list": [<ProductDto>], "total": 20 }`

---

### GET `/api/menu/product/detail` (Bearer)

- Query: `id` (required, UUID)
- Response `data`: `<ProductDto>` (tuong tu `list`)

---

### GET `/api/menu/product/simple-list` (Bearer)

- Query: `categoryId` (optional)
- Response `data`: `[{ "id": "uuid", "name": "...", "price": 35000 }]`

---

### POST `/api/menu/product/create` (ADMIN)

```json
{
  "name": "Ca phe den",
  "categoryId": "uuid",
  "description": null,
  "imageUrl": null,
  "price": 25000,
  "prepTime": 3,
  "sortOrder": 1,
  "status": "AVAILABLE",
  "isActive": true
}
```

---

### PUT `/api/menu/product/update` (ADMIN)

```json
{
  "id": "uuid",
  "name": "Ca phe den updated",
  "categoryId": "uuid",
  "description": null,
  "imageUrl": null,
  "price": 25000,
  "prepTime": 3,
  "sortOrder": 1,
  "status": "AVAILABLE",
  "isActive": true
}
```

---

### PUT `/api/menu/product/status` (ADMIN, MODERATOR)

```json
{
  "id": "uuid",
  "status": "OUT_OF_STOCK"
}
```

---

### DELETE `/api/menu/product/delete` (ADMIN)

- Query: `id` (required, UUID)
- Rule: Khong the xoa san pham da co trong don hang.

---

## 7) Table APIs

### GET `/api/table/page` (Bearer)

- Query (optional): `pageNo`, `pageSize`, `area`, `status` = `AVAILABLE | OCCUPIED`
- Response `data`:

```json
{
  "list": [
    {
      "id": "uuid",
      "name": "Ban 01",
      "area": "Tang 1",
      "status": "AVAILABLE",
      "qrToken": "uuid-v4",
      "qrCodeUrl": "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=http%3A%2F%2Flocalhost%3A3000%2Fmenu%2F<qrToken>",
      "currentOrderId": null,
      "createdAt": "2026-05-01T00:00:00.000Z"
    }
  ],
  "total": 10
}
```

> `qrCodeUrl`: computed dong tu `APP_FRONTEND_URL/menu/<qrToken>`, khong luu DB.  
> `currentOrderId`: set khi co order tao, null khi tat ca order cua ban da PAID/CANCELLED.

---

### GET `/api/table/list` (Bearer)

- Response `data`: `[<TableDto>]` — tuong tu tren, full list.

---

### GET `/api/table/areas` (Bearer)

- Response `data`: `[{ "id": "Tang 1", "name": "Tang 1" }]`

---

### GET `/api/table/by-token/:token` (Public)

- Param: `token`
- Response `data` (gon cho khach):

```json
{
  "id": "uuid",
  "name": "Ban 01",
  "area": "Tang 1",
  "status": "AVAILABLE"
}
```

---

### POST `/api/table/create` (ADMIN)

```json
{
  "name": "Ban 09",
  "area": "Tang 2"
}
```

---

### PUT `/api/table/update` (ADMIN)

```json
{
  "id": "uuid",
  "name": "Ban 09 updated",
  "area": "Tang 2"
}
```

---

### PUT `/api/table/regenerate-qr` (ADMIN)

```json
{ "id": "uuid" }
```

---

### DELETE `/api/table/delete` (ADMIN)

- Query: `id` (required, UUID)
- Rule: Ban `OCCUPIED` → 400 "Ban dang co khach, khong the xoa".

---

## 8) Order APIs

### OrderDto — Response shape

Tat ca order API tra ve cung shape nay:

```json
{
  "id": "uuid",
  "tableId": "uuid",
  "tableName": "Ban 01",
  "tableToken": "uuid-v4",
  "status": "PENDING",
  "items": [
    {
      "id": "uuid",
      "productId": "uuid",
      "productName": "Ca phe sua",
      "productImageUrl": "http://localhost:8080/uploads/xxx.jpg",
      "price": 35000,
      "quantity": 2,
      "subtotal": 70000,
      "note": "it duong"
    }
  ],
  "totalAmount": 70000,
  "estimateWaitMinutes": 6,
  "note": "ban goc trong",
  "paymentRequested": false,
  "createdAt": "2026-05-05T10:00:00.000Z",
  "updatedAt": "2026-05-05T10:01:00.000Z"
}
```

> - `productImageUrl`: snapshot URL tai thoi diem dat hang (khong thay doi neu admin sua sau).
> - `subtotal` = `price × quantity`.
> - `estimatedWaitMinutes`: tinh luc tao don, co the null neu he thong khong tinh.

---

### POST `/api/order/create` (Public)

- Body:

```json
{
  "tableToken": "uuid-v4",
  "items": [{ "productId": "uuid", "quantity": 2, "note": "it duong" }],
  "note": "ban goc trong"
}
```

- Side effect: `table.status → OCCUPIED`, `table.currentOrderId → order.id` (update mỗi lần tao don moi, ke ca khi ban da OCCUPIED — cho phep dat them don trong cung phien)
- Luu y: Khach co the tao nhieu don tren cung ban trong cung phien ngoi.
- Phat SSE: `new_order { orderId, tableId, tableName }`
- Response `data`: `<OrderDto>`

---

### GET `/api/order/page` (Bearer)

- Query (optional):
  - `pageNo` (default 1), `pageSize` (default 20)
  - `status` = `PENDING | CONFIRMED | PREPARING | READY | COMPLETED | PAID | CANCELLED`
  - `tableId`, `date` (`YYYY-MM-DD`)
- Response `data`: `{ "list": [<OrderDto>], "total": 50 }`

---

### GET `/api/order/detail` (Bearer)

- Query: `id` (required, UUID)
- Response `data`: `<OrderDto>`

---

### GET `/api/order/by-token/:token` (Public)

- Param: `token`
- Rule: Chi tra don **chua thanh toan** (`NOT IN PAID, CANCELLED`), sort `createdAt DESC`.
- Response `data`: `[<OrderDto>]` (mang, co the nhieu don cung ban)

---

### GET `/api/order/estimated-wait` (Public)

- Response `data`:

```json
{ "estimatedMinutes": 12 }
```

> Cong thuc: `ceil(sum(quantity × prepTime) / 3)` voi don dang CONFIRMED/PREPARING.

---

### PUT `/api/order/status` (Bearer)

- Body:

```json
{ "id": "uuid", "status": "PREPARING" }
```

- Luong trang thai hop le:

```
PENDING → CONFIRMED, CANCELLED
CONFIRMED → PREPARING, CANCELLED
PREPARING → READY, CANCELLED
READY → COMPLETED, CANCELLED
COMPLETED → PAID, CANCELLED
```

- Side effect khi COMPLETED/PAID/CANCELLED: dong bo ban — neu **con don chua thanh toan** tren ban thi `table.status` giu `OCCUPIED`, `currentOrderId` = don **moi nhat** (theo `createdAt`) trong so don `NOT IN (PAID, CANCELLED)`; neu **khong con** thi `AVAILABLE`, `currentOrderId → null`.
- Phat SSE: `order_status_changed { orderId, status, tableId, tableName }`
- Response `data`: `<OrderDto>`

---

### POST `/api/order/request-payment` (Public)

```json
{ "orderId": "uuid" }
```

- Phat SSE: `payment_request { orderId, tableId, tableName }`
- Response `data`: `{ "message": "Da gui yeu cau thanh toan" }`

---

### POST `/api/order/checkout/preview` (Public)

- Body:

```json
{
  "tableToken": "uuid-v4",
  "orderIds": ["uuid-optional"]
}
```

- `orderIds` bo trong: lay **tat ca** don chua thanh toan cua ban. Co `orderIds`: chi cac don do (phai thuoc ban va dang mo).
- Response `data`: `{ tableId, tableName, tableToken, orderIds, totalAmount, orders: [<OrderDto>] }`

---

### POST `/api/order/checkout/start` (Public)

- Body: giong `checkout/preview`, them optional `ttlMinutes` (5–120, mac dinh 15).
- Tao ban ghi `checkout_sessions` (PENDING), tra ve `sessionId`, `clientSecret` (chi dung cho buoc `complete`), `expiresAt`, tong tien va don.
- FE: luu `clientSecret` an toan (memory / secure storage), hien **mot ma / mot so tien** = `totalAmount` cho mot lan quet.

---

### POST `/api/order/checkout/complete` (Public)

- Body:

```json
{
  "sessionId": "uuid",
  "tableToken": "uuid-v4",
  "clientSecret": "hex-tu-checkout-start"
}
```

- Trong mot transaction: chuyen **tat ca** don trong phien sang `PAID`, danh dau phien `COMPLETED`, dong bo ban (nhu PUT status).
- Goi lai voi phien da xong: tra `idempotent: true` cung payload tom tat.
- Het han (`expiresAt`): 400.
- Phat SSE: `payment_completed`, roi `order_status_changed` cho tung don.

---

### POST `/api/order/checkout/complete-staff` (Bearer, ADMIN | MODERATOR)

- Body: `{ "sessionId": "uuid" }`
- Giong `complete` nhung **khong can** `clientSecret` — thu ngan xac nhan tien mat / POS noi bo sau khi da co phien tu `checkout/start`.

---

### POST `/api/order/request-payment-batch` (Public)

- Body:

```json
{
  "tableToken": "uuid-v4",
  "orderIds": ["uuid", "uuid"]
}
```

- Bat `paymentRequested` cho cac don (neu chua), phat SSE `payment_request_batch { orderIds, tableId, tableName, totalAmount }`.

---

### GET `/api/order/stats/revenue` (ADMIN)

- Query (optional):
  - `period` = `day | week | month` (default `day`)
  - `from`, `to` (YYYY-MM-DD)
- Response `data`:

```json
{
  "totalRevenue": 1200000,
  "totalOrders": 48,
  "data": [{ "date": "2026-05-05", "revenue": 500000, "orderCount": 20 }]
}
```

---

### GET `/api/order/stats/top-products` (ADMIN)

- Query (optional): `limit` (default 10), `from`, `to` (YYYY-MM-DD)
- Response `data`:

```json
[
  {
    "productId": "uuid",
    "productName": "Ca phe sua",
    "totalQuantity": 120,
    "totalRevenue": 3000000
  }
]
```

---

## 9) SSE API

### GET `/api/order/events`

- Auth: Access token **qua query param** (khong phai header):

```
GET /api/order/events?token=<accessToken>
```

- Ly do: Browser `EventSource` khong ho tro custom header. JWT strategy da duoc cap nhat de doc tu ca header va query param.
- Consume tren FE:

```ts
const token = getAccessToken(); // lay tu store
const es = new EventSource(`/api/order/events?token=${token}`);

es.addEventListener('new_order', (e) => {
  const data = JSON.parse(e.data);
  // { orderId, tableId, tableName }
});

es.addEventListener('payment_request', (e) => {
  const data = JSON.parse(e.data);
  // { orderId, tableId, tableName }
});

es.addEventListener('payment_request_batch', (e) => {
  const data = JSON.parse(e.data);
  // { orderIds, tableId, tableName, totalAmount }
});

es.addEventListener('payment_completed', (e) => {
  const data = JSON.parse(e.data);
  // { sessionId, tableId, tableToken, orderIds, totalAmount }
});

es.addEventListener('order_status_changed', (e) => {
  const data = JSON.parse(e.data);
  // { orderId, status, tableId, tableName }
});
```

---

## 10) Upload API

### POST `/api/upload/image` (Bearer)

- Content-Type: `multipart/form-data`
- Field: `file` (binary image — jpg, png, webp, gif, max 5MB)
- Response `data`:

```json
{ "url": "http://localhost:8080/uploads/<filename>" }
```

---

## 11) Health API

### GET `/api/health` (Public)

- Kiem tra DB + memory heap.

---

## 12) Enum Reference

### UserRole

- `ADMIN`, `MODERATOR`

### ProductStatus

- `AVAILABLE`, `UNAVAILABLE`, `OUT_OF_STOCK`

### TableStatus

- `AVAILABLE`, `OCCUPIED`

### OrderStatus

- `PENDING` → `CONFIRMED` → `PREPARING` → `READY` → `COMPLETED` → `PAID`
- (bat ky trang thai → `CANCELLED`)

### Permission (theo role)

- `ADMIN`: `menu:write`, `table:write`, `order:write`, `staff:write`
- `MODERATOR`: `order:write`, `order:read`
