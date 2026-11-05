"""initial schema

Revision ID: 0001
Revises:
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.core.clock import SystemClock

revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "employee",
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "ADMIN", "STAFF", name="role", native_enum=False, create_constraint=True, length=32
            ),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("token_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_employee")),
        sa.UniqueConstraint("username", name=op.f("uq_employee_username")),
    )
    op.create_table(
        "ingredient_category",
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ingredient_category")),
        sa.UniqueConstraint("code", name=op.f("uq_ingredient_category_code")),
    )
    op.create_table(
        "storage_location",
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "storage_type",
            sa.Enum(
                "REFRIGERATED",
                "FROZEN",
                "AMBIENT",
                name="storage_type",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_storage_location")),
        sa.UniqueConstraint("code", name=op.f("uq_storage_location_code")),
    )
    op.create_table(
        "supplier",
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("contact_person", sa.String(length=100), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("other_contact", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_supplier")),
    )
    op.create_table(
        "alert_setting",
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("warning_days", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by_id", sa.BigInteger(), nullable=True),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.CheckConstraint(
            "warning_days >= 0", name=op.f("ck_alert_setting_warning_days_non_negative")
        ),
        sa.ForeignKeyConstraint(
            ["updated_by_id"], ["employee.id"], name=op.f("fk_alert_setting_updated_by_id_employee")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_alert_setting")),
    )
    op.create_table(
        "goods_receipt",
        sa.Column("supplier_id", sa.BigInteger(), nullable=False),
        sa.Column("receipt_date", sa.Date(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "DRAFT",
                "CONFIRMED",
                "REVERSED",
                name="status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("created_by_id", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.ForeignKeyConstraint(
            ["created_by_id"], ["employee.id"], name=op.f("fk_goods_receipt_created_by_id_employee")
        ),
        sa.ForeignKeyConstraint(
            ["supplier_id"], ["supplier.id"], name=op.f("fk_goods_receipt_supplier_id_supplier")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_goods_receipt")),
    )
    op.create_table(
        "ingredient",
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("category_id", sa.BigInteger(), nullable=False),
        sa.Column("unit", sa.String(length=16), nullable=False),
        sa.Column(
            "storage_method",
            sa.Enum(
                "REFRIGERATED",
                "FROZEN",
                "AMBIENT",
                name="storage_method",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("safety_stock_quantity", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.CheckConstraint(
            "safety_stock_quantity >= 0",
            name=op.f("ck_ingredient_safety_stock_quantity_non_negative"),
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["ingredient_category.id"],
            name=op.f("fk_ingredient_category_id_ingredient_category"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ingredient")),
        sa.UniqueConstraint("name", name=op.f("uq_ingredient_name")),
    )
    op.create_table(
        "goods_receipt_item",
        sa.Column("receipt_id", sa.BigInteger(), nullable=False),
        sa.Column("ingredient_id", sa.BigInteger(), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column("unit_price", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("location_id", sa.BigInteger(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_goods_receipt_item_quantity_positive")),
        sa.CheckConstraint(
            "unit_price >= 0", name=op.f("ck_goods_receipt_item_unit_price_non_negative")
        ),
        sa.ForeignKeyConstraint(
            ["ingredient_id"],
            ["ingredient.id"],
            name=op.f("fk_goods_receipt_item_ingredient_id_ingredient"),
        ),
        sa.ForeignKeyConstraint(
            ["location_id"],
            ["storage_location.id"],
            name=op.f("fk_goods_receipt_item_location_id_storage_location"),
        ),
        sa.ForeignKeyConstraint(
            ["receipt_id"],
            ["goods_receipt.id"],
            name=op.f("fk_goods_receipt_item_receipt_id_goods_receipt"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_goods_receipt_item")),
    )
    op.create_index(
        op.f("ix_goods_receipt_item_receipt_id"), "goods_receipt_item", ["receipt_id"], unique=False
    )
    op.create_table(
        "inventory_batch",
        sa.Column("batch_number", sa.String(length=32), nullable=False),
        sa.Column("source_item_id", sa.BigInteger(), nullable=False),
        sa.Column("ingredient_id", sa.BigInteger(), nullable=False),
        sa.Column("expiry_date", sa.Date(), nullable=False),
        sa.Column("received_date", sa.Date(), nullable=False),
        sa.Column("current_location_id", sa.BigInteger(), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("initial_quantity", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("remaining_quantity", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.CheckConstraint(
            "initial_quantity > 0", name=op.f("ck_inventory_batch_initial_quantity_positive")
        ),
        sa.CheckConstraint(
            "remaining_quantity >= 0",
            name=op.f("ck_inventory_batch_remaining_quantity_non_negative"),
        ),
        sa.CheckConstraint(
            "unit_price >= 0", name=op.f("ck_inventory_batch_unit_price_non_negative")
        ),
        sa.ForeignKeyConstraint(
            ["current_location_id"],
            ["storage_location.id"],
            name=op.f("fk_inventory_batch_current_location_id_storage_location"),
        ),
        sa.ForeignKeyConstraint(
            ["ingredient_id"],
            ["ingredient.id"],
            name=op.f("fk_inventory_batch_ingredient_id_ingredient"),
        ),
        sa.ForeignKeyConstraint(
            ["source_item_id"],
            ["goods_receipt_item.id"],
            name=op.f("fk_inventory_batch_source_item_id_goods_receipt_item"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_inventory_batch")),
        sa.UniqueConstraint("batch_number", name=op.f("uq_inventory_batch_batch_number")),
        sa.UniqueConstraint("source_item_id", name=op.f("uq_inventory_batch_source_item_id")),
    )
    op.create_index(
        op.f("ix_inventory_batch_ingredient_id"), "inventory_batch", ["ingredient_id"], unique=False
    )
    op.create_table(
        "batch_location_change",
        sa.Column("batch_id", sa.BigInteger(), nullable=False),
        sa.Column("from_location_id", sa.BigInteger(), nullable=False),
        sa.Column("to_location_id", sa.BigInteger(), nullable=False),
        sa.Column("operator_id", sa.BigInteger(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["inventory_batch.id"],
            name=op.f("fk_batch_location_change_batch_id_inventory_batch"),
        ),
        sa.ForeignKeyConstraint(
            ["from_location_id"],
            ["storage_location.id"],
            name=op.f("fk_batch_location_change_from_location_id_storage_location"),
        ),
        sa.ForeignKeyConstraint(
            ["operator_id"],
            ["employee.id"],
            name=op.f("fk_batch_location_change_operator_id_employee"),
        ),
        sa.ForeignKeyConstraint(
            ["to_location_id"],
            ["storage_location.id"],
            name=op.f("fk_batch_location_change_to_location_id_storage_location"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_batch_location_change")),
    )
    op.create_index(
        op.f("ix_batch_location_change_batch_id"),
        "batch_location_change",
        ["batch_id"],
        unique=False,
    )
    op.create_table(
        "inventory_transaction",
        sa.Column("operation_group_id", sa.Uuid(), nullable=False),
        sa.Column("batch_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "RECEIPT",
                "ISSUE",
                "WASTE",
                "ADJUSTMENT",
                "REVERSAL",
                name="type",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("quantity_delta", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("quantity_before", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("quantity_after", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("operator_id", sa.BigInteger(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("is_non_fefo", sa.Boolean(), nullable=False),
        sa.Column("reverses_transaction_id", sa.BigInteger(), nullable=True),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.CheckConstraint(
            "(type = 'REVERSAL') = (reverses_transaction_id IS NOT NULL)",
            name=op.f("ck_inventory_transaction_reversal_link"),
        ),
        sa.CheckConstraint(
            "quantity_after = quantity_before + quantity_delta",
            name=op.f("ck_inventory_transaction_quantity_balance"),
        ),
        sa.CheckConstraint(
            "quantity_after >= 0", name=op.f("ck_inventory_transaction_quantity_after_non_negative")
        ),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["inventory_batch.id"],
            name=op.f("fk_inventory_transaction_batch_id_inventory_batch"),
        ),
        sa.ForeignKeyConstraint(
            ["operator_id"],
            ["employee.id"],
            name=op.f("fk_inventory_transaction_operator_id_employee"),
        ),
        sa.ForeignKeyConstraint(
            ["reverses_transaction_id"],
            ["inventory_transaction.id"],
            name="fk_inventory_transaction_reverses",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_inventory_transaction")),
        sa.UniqueConstraint(
            "operation_group_id",
            "batch_id",
            name=op.f("uq_inventory_transaction_operation_group_id_batch_id"),
        ),
        sa.UniqueConstraint(
            "reverses_transaction_id", name=op.f("uq_inventory_transaction_reverses_transaction_id")
        ),
    )
    op.create_index(
        op.f("ix_inventory_transaction_batch_id"),
        "inventory_transaction",
        ["batch_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_inventory_transaction_occurred_at"),
        "inventory_transaction",
        ["occurred_at"],
        unique=False,
    )
    op.create_table(
        "waste_record",
        sa.Column("batch_id", sa.BigInteger(), nullable=False),
        sa.Column("transaction_id", sa.BigInteger(), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column(
            "reason",
            sa.Enum(
                "EXPIRED",
                "SPOILED",
                "DAMAGED",
                "OTHER",
                name="reason",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("loss_amount", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("operator_id", sa.BigInteger(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_waste_record_quantity_positive")),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["inventory_batch.id"],
            name=op.f("fk_waste_record_batch_id_inventory_batch"),
        ),
        sa.ForeignKeyConstraint(
            ["operator_id"], ["employee.id"], name=op.f("fk_waste_record_operator_id_employee")
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["inventory_transaction.id"],
            name=op.f("fk_waste_record_transaction_id_inventory_transaction"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_waste_record")),
        sa.UniqueConstraint("transaction_id", name=op.f("uq_waste_record_transaction_id")),
    )
    op.create_index(op.f("ix_waste_record_batch_id"), "waste_record", ["batch_id"], unique=False)
    op.create_index(
        op.f("ix_waste_record_occurred_at"), "waste_record", ["occurred_at"], unique=False
    )

    # AD-13：alert_setting 為單列，預警天數預設 3（A7）。時間欄位無 server default（AD-10）。
    now = SystemClock().now()
    op.execute(
        sa.table(
            "alert_setting",
            sa.column("name", sa.String),
            sa.column("warning_days", sa.Integer),
            sa.column("created_at", sa.DateTime(timezone=True)),
            sa.column("updated_at", sa.DateTime(timezone=True)),
        )
        .insert()
        .values(name="全店預警設定", warning_days=3, created_at=now, updated_at=now)
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_waste_record_occurred_at"), table_name="waste_record")
    op.drop_index(op.f("ix_waste_record_batch_id"), table_name="waste_record")
    op.drop_table("waste_record")
    op.drop_index(op.f("ix_inventory_transaction_occurred_at"), table_name="inventory_transaction")
    op.drop_index(op.f("ix_inventory_transaction_batch_id"), table_name="inventory_transaction")
    op.drop_table("inventory_transaction")
    op.drop_index(op.f("ix_batch_location_change_batch_id"), table_name="batch_location_change")
    op.drop_table("batch_location_change")
    op.drop_index(op.f("ix_inventory_batch_ingredient_id"), table_name="inventory_batch")
    op.drop_table("inventory_batch")
    op.drop_index(op.f("ix_goods_receipt_item_receipt_id"), table_name="goods_receipt_item")
    op.drop_table("goods_receipt_item")
    op.drop_table("ingredient")
    op.drop_table("goods_receipt")
    op.drop_table("alert_setting")
    op.drop_table("supplier")
    op.drop_table("storage_location")
    op.drop_table("ingredient_category")
    op.drop_table("employee")
