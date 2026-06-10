CREATE TABLE recycle_category (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  description VARCHAR(255) NOT NULL
);

CREATE TABLE recycle_appointment (
  id VARCHAR(32) PRIMARY KEY,
  customer_name VARCHAR(60) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address VARCHAR(255) NOT NULL,
  category_id VARCHAR(32) NOT NULL,
  item_description TEXT NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  recycler_name VARCHAR(60) DEFAULT '',
  estimated_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  CONSTRAINT fk_recycle_appointment_category
    FOREIGN KEY (category_id) REFERENCES recycle_category(id),
  CONSTRAINT chk_recycle_appointment_status
    CHECK (status IN ('pending', 'scheduled', 'assigned', 'completed', 'cancelled'))
);

CREATE INDEX idx_recycle_appointment_status ON recycle_appointment(status);
CREATE INDEX idx_recycle_appointment_phone ON recycle_appointment(phone);
CREATE INDEX idx_recycle_appointment_preferred_date ON recycle_appointment(preferred_date);

INSERT INTO recycle_category (id, name, description) VALUES
  ('appliance', '家电', '冰箱、洗衣机、空调、电视等大件家电'),
  ('furniture', '家具', '沙发、床垫、柜子、桌椅等旧家具'),
  ('digital', '数码设备', '手机、电脑、显示器、打印机等电子设备'),
  ('metal', '金属纸品', '废铁、铝材、纸箱、书本等可回收物');

INSERT INTO recycle_appointment (
  id,
  customer_name,
  phone,
  address,
  category_id,
  item_description,
  preferred_date,
  preferred_time,
  status,
  recycler_name,
  estimated_amount,
  note,
  created_at,
  updated_at
) VALUES
  (
    'AP20260610001',
    '林女士',
    '13800001111',
    '浦东新区民生路 1288 号',
    'appliance',
    '双门冰箱一台，可正常通电，电梯房',
    '2026-06-12',
    '09:00-12:00',
    'assigned',
    '周师傅',
    120.00,
    '师傅已电话确认上门时间',
    '2026-06-10 09:10:00',
    '2026-06-10 10:20:00'
  );
