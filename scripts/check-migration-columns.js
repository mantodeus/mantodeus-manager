const mysql = require("mysql2/promise");

const requiredColumns = [
  { table: "company_settings", column: "invoiceNumberFormat" },
  { table: "company_settings", column: "streetName" },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required for migration checks");
    process.exit(1);
  }

  let connection;
  try {
    connection = await mysql.createConnection(databaseUrl);
    const [rows] = await connection.execute(
      `SELECT TABLE_NAME as tableName, COLUMN_NAME as columnName
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND ((TABLE_NAME = ? AND COLUMN_NAME = ?) OR (TABLE_NAME = ? AND COLUMN_NAME = ?))`,
      [
        requiredColumns[0].table,
        requiredColumns[0].column,
        requiredColumns[1].table,
        requiredColumns[1].column,
      ]
    );

    const found = new Set(rows.map((row) => `${row.tableName}.${row.columnName}`));
    const missing = requiredColumns.filter(
      (item) => !found.has(`${item.table}.${item.column}`)
    );

    if (missing.length) {
      console.error("Missing required columns after migration:");
      missing.forEach((item) => console.error(`- ${item.table}.${item.column}`));
      process.exit(1);
    }

    console.log("Migration sanity check passed");
  } catch (error) {
    console.error("Migration sanity check failed:", error.message || error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();