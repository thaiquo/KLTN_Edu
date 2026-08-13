CREATE TABLE administrative_provinces (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE administrative_communes (
    code VARCHAR(40) PRIMARY KEY,
    province_code VARCHAR(30) NOT NULL,
    name VARCHAR(160) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_administrative_communes_province
        FOREIGN KEY (province_code)
        REFERENCES administrative_provinces (code),
    CONSTRAINT uk_administrative_communes_province_name
        UNIQUE (province_code, name)
);

CREATE INDEX idx_administrative_communes_province
    ON administrative_communes (province_code);

ALTER TABLE users
    ADD COLUMN province_code VARCHAR(30),
    ADD COLUMN commune_code VARCHAR(40),
    ADD COLUMN commune VARCHAR(160);

ALTER TABLE tutor_applications
    ADD COLUMN applicant_full_name VARCHAR(100),
    ADD COLUMN applicant_email VARCHAR(255),
    ADD COLUMN applicant_phone VARCHAR(20),
    ADD COLUMN applicant_date_of_birth DATE,
    ADD COLUMN applicant_gender VARCHAR(30),
    ADD COLUMN applicant_province_code VARCHAR(30),
    ADD COLUMN applicant_province_name VARCHAR(120),
    ADD COLUMN applicant_commune_code VARCHAR(40),
    ADD COLUMN applicant_commune_name VARCHAR(160),
    ADD COLUMN applicant_address_detail VARCHAR(255),
    ADD COLUMN applicant_avatar_key VARCHAR(512);

INSERT INTO administrative_provinces (code, name, sort_order) VALUES
    ('HA_NOI', 'Thành phố Hà Nội', 1),
    ('HUE', 'Thành phố Huế', 2),
    ('HAI_PHONG', 'Thành phố Hải Phòng', 3),
    ('DA_NANG', 'Thành phố Đà Nẵng', 4),
    ('HO_CHI_MINH', 'Thành phố Hồ Chí Minh', 5),
    ('CAN_THO', 'Thành phố Cần Thơ', 6),
    ('LAI_CHAU', 'Tỉnh Lai Châu', 7),
    ('DIEN_BIEN', 'Tỉnh Điện Biên', 8),
    ('SON_LA', 'Tỉnh Sơn La', 9),
    ('LANG_SON', 'Tỉnh Lạng Sơn', 10),
    ('QUANG_NINH', 'Tỉnh Quảng Ninh', 11),
    ('THANH_HOA', 'Tỉnh Thanh Hóa', 12),
    ('NGHE_AN', 'Tỉnh Nghệ An', 13),
    ('HA_TINH', 'Tỉnh Hà Tĩnh', 14),
    ('CAO_BANG', 'Tỉnh Cao Bằng', 15),
    ('TUYEN_QUANG', 'Tỉnh Tuyên Quang', 16),
    ('LAO_CAI', 'Tỉnh Lào Cai', 17),
    ('THAI_NGUYEN', 'Tỉnh Thái Nguyên', 18),
    ('PHU_THO', 'Tỉnh Phú Thọ', 19),
    ('BAC_NINH', 'Tỉnh Bắc Ninh', 20),
    ('HUNG_YEN', 'Tỉnh Hưng Yên', 21),
    ('NINH_BINH', 'Tỉnh Ninh Bình', 22),
    ('QUANG_TRI', 'Tỉnh Quảng Trị', 23),
    ('QUANG_NGAI', 'Tỉnh Quảng Ngãi', 24),
    ('GIA_LAI', 'Tỉnh Gia Lai', 25),
    ('KHANH_HOA', 'Tỉnh Khánh Hòa', 26),
    ('LAM_DONG', 'Tỉnh Lâm Đồng', 27),
    ('DAK_LAK', 'Tỉnh Đắk Lắk', 28),
    ('DONG_NAI', 'Tỉnh Đồng Nai', 29),
    ('TAY_NINH', 'Tỉnh Tây Ninh', 30),
    ('VINH_LONG', 'Tỉnh Vĩnh Long', 31),
    ('DONG_THAP', 'Tỉnh Đồng Tháp', 32),
    ('AN_GIANG', 'Tỉnh An Giang', 33),
    ('CA_MAU', 'Tỉnh Cà Mau', 34)
ON CONFLICT (code) DO NOTHING;

INSERT INTO administrative_communes (code, province_code, name, sort_order) VALUES
    ('HCM_SAI_GON', 'HO_CHI_MINH', 'Phường Sài Gòn', 1),
    ('HCM_BEN_THANH', 'HO_CHI_MINH', 'Phường Bến Thành', 2),
    ('HCM_CAU_ONG_LANH', 'HO_CHI_MINH', 'Phường Cầu Ông Lãnh', 3),
    ('HCM_BAN_CO', 'HO_CHI_MINH', 'Phường Bàn Cờ', 4),
    ('HCM_XUAN_HOA', 'HO_CHI_MINH', 'Phường Xuân Hòa', 5),
    ('HCM_NHIEU_LOC', 'HO_CHI_MINH', 'Phường Nhiêu Lộc', 6),
    ('HCM_TAN_DINH', 'HO_CHI_MINH', 'Phường Tân Định', 7),
    ('HCM_CHO_QUAN', 'HO_CHI_MINH', 'Phường Chợ Quán', 8),
    ('HCM_AN_DONG', 'HO_CHI_MINH', 'Phường An Đông', 9),
    ('HCM_CHO_LON', 'HO_CHI_MINH', 'Phường Chợ Lớn', 10),
    ('HCM_BINH_TAY', 'HO_CHI_MINH', 'Phường Bình Tây', 11),
    ('HCM_HOA_HUNG', 'HO_CHI_MINH', 'Phường Hòa Hưng', 12),
    ('HCM_VUON_LAI', 'HO_CHI_MINH', 'Phường Vườn Lài', 13),
    ('HCM_PHU_THO_HOA', 'HO_CHI_MINH', 'Phường Phú Thọ Hòa', 14),
    ('HCM_TAN_SON_NHI', 'HO_CHI_MINH', 'Phường Tân Sơn Nhì', 15),
    ('HCM_TAN_SON_HOA', 'HO_CHI_MINH', 'Phường Tân Sơn Hòa', 16),
    ('HCM_BAY_HIEN', 'HO_CHI_MINH', 'Phường Bảy Hiền', 17),
    ('HCM_GIA_DINH', 'HO_CHI_MINH', 'Phường Gia Định', 18),
    ('HCM_BINH_THANH', 'HO_CHI_MINH', 'Phường Bình Thạnh', 19),
    ('HCM_THANH_MY_TAY', 'HO_CHI_MINH', 'Phường Thạnh Mỹ Tây', 20),
    ('HCM_HANH_THONG', 'HO_CHI_MINH', 'Phường Hạnh Thông', 21),
    ('HCM_GO_VAP', 'HO_CHI_MINH', 'Phường Gò Vấp', 22),
    ('HCM_AN_NHON', 'HO_CHI_MINH', 'Phường An Nhơn', 23),
    ('HCM_THU_DUC', 'HO_CHI_MINH', 'Phường Thủ Đức', 24),
    ('HCM_LINH_XUAN', 'HO_CHI_MINH', 'Phường Linh Xuân', 25),
    ('HCM_HIEP_BINH', 'HO_CHI_MINH', 'Phường Hiệp Bình', 26),
    ('HN_HOAN_KIEM', 'HA_NOI', 'Phường Hoàn Kiếm', 1),
    ('HN_CUA_NAM', 'HA_NOI', 'Phường Cửa Nam', 2),
    ('HN_BA_DINH', 'HA_NOI', 'Phường Ba Đình', 3),
    ('HN_NGOC_HA', 'HA_NOI', 'Phường Ngọc Hà', 4),
    ('HN_GIANG_VO', 'HA_NOI', 'Phường Giảng Võ', 5),
    ('HN_HAI_BA_TRUNG', 'HA_NOI', 'Phường Hai Bà Trưng', 6),
    ('HN_BACH_MAI', 'HA_NOI', 'Phường Bạch Mai', 7),
    ('HN_VAN_MIEU_QUOC_TU_GIAM', 'HA_NOI', 'Phường Văn Miếu - Quốc Tử Giám', 8),
    ('HN_DONG_DA', 'HA_NOI', 'Phường Đống Đa', 9),
    ('HN_KIM_LIEN', 'HA_NOI', 'Phường Kim Liên', 10),
    ('DN_HAI_CHAU', 'DA_NANG', 'Phường Hải Châu', 1),
    ('DN_THANH_KHE', 'DA_NANG', 'Phường Thanh Khê', 2),
    ('DN_SON_TRA', 'DA_NANG', 'Phường Sơn Trà', 3),
    ('DN_NGU_HANH_SON', 'DA_NANG', 'Phường Ngũ Hành Sơn', 4),
    ('CT_NINH_KIEU', 'CAN_THO', 'Phường Ninh Kiều', 1),
    ('CT_CAI_RANG', 'CAN_THO', 'Phường Cái Răng', 2),
    ('HP_HONG_BANG', 'HAI_PHONG', 'Phường Hồng Bàng', 1),
    ('HP_NGO_QUYEN', 'HAI_PHONG', 'Phường Ngô Quyền', 2),
    ('HUE_THUAN_HOA', 'HUE', 'Phường Thuận Hóa', 1),
    ('HUE_PHU_XUAN', 'HUE', 'Phường Phú Xuân', 2)
ON CONFLICT (code) DO NOTHING;
