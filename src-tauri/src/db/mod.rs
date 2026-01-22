// AlgoTrade OS - Database Module
// SQLite database for persistent storage (drawings, settings, etc.)

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tokio::sync::Mutex;
use std::path::PathBuf;

// Global database connection
static DB_CONNECTION: OnceLock<Mutex<Connection>> = OnceLock::new();

/// Drawing data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Drawing {
    pub id: String,
    pub symbol: String,
    pub interval: String,
    pub drawing_type: String,
    pub points: String,      // JSON string: [{time, price}, ...]
    pub style: String,       // JSON string: {color, lineWidth, ...}
    pub visible: bool,
    pub locked: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Drawing point (for serialization)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrawingPoint {
    pub time: i64,     // Unix timestamp in seconds
    pub price: f64,    // Price value
}

/// Drawing style
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrawingStyle {
    pub color: String,
    pub line_width: u32,
    #[serde(default)]
    pub line_style: String,  // solid, dashed, dotted
    #[serde(default)]
    pub fill_color: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
}

impl Default for DrawingStyle {
    fn default() -> Self {
        Self {
            color: "#2962FF".to_string(),
            line_width: 2,
            line_style: "solid".to_string(),
            fill_color: None,
            text: None,
        }
    }
}

/// Get database path
fn get_db_path() -> PathBuf {
    // Use app data directory for persistent storage
    let base_path = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    let app_path = base_path.join("algotrade-os");

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&app_path).ok();

    app_path.join("drawings.db")
}

/// Initialize database connection and create tables
pub fn init_database() -> Result<(), String> {
    let db_path = get_db_path();
    tracing::info!("Database path: {:?}", db_path);

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Create drawings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS drawings (
            id TEXT PRIMARY KEY,
            symbol TEXT NOT NULL,
            interval TEXT NOT NULL,
            drawing_type TEXT NOT NULL,
            points TEXT NOT NULL,
            style TEXT NOT NULL,
            visible INTEGER DEFAULT 1,
            locked INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    ).map_err(|e| format!("Failed to create drawings table: {}", e))?;

    // Create index for faster lookups
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_drawings_symbol_interval
         ON drawings(symbol, interval)",
        [],
    ).map_err(|e| format!("Failed to create index: {}", e))?;

    // Store connection globally
    let _ = DB_CONNECTION.set(Mutex::new(conn));

    tracing::info!("Database initialized successfully");
    Ok(())
}

/// Get database connection
fn get_connection() -> Result<&'static Mutex<Connection>, String> {
    DB_CONNECTION.get().ok_or_else(|| "Database not initialized".to_string())
}

/// Save or update a drawing
pub async fn save_drawing(drawing: Drawing) -> Result<Drawing, String> {
    let conn = get_connection()?;
    let conn = conn.lock().await;

    let now = chrono::Utc::now().timestamp();

    // Check if drawing exists
    let exists: bool = conn.query_row(
        "SELECT 1 FROM drawings WHERE id = ?",
        params![&drawing.id],
        |_| Ok(true),
    ).unwrap_or(false);

    if exists {
        // Update existing drawing
        conn.execute(
            "UPDATE drawings SET
                symbol = ?, interval = ?, drawing_type = ?,
                points = ?, style = ?, visible = ?, locked = ?, updated_at = ?
             WHERE id = ?",
            params![
                &drawing.symbol,
                &drawing.interval,
                &drawing.drawing_type,
                &drawing.points,
                &drawing.style,
                drawing.visible as i32,
                drawing.locked as i32,
                now,
                &drawing.id,
            ],
        ).map_err(|e| format!("Failed to update drawing: {}", e))?;
    } else {
        // Insert new drawing
        conn.execute(
            "INSERT INTO drawings (id, symbol, interval, drawing_type, points, style, visible, locked, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                &drawing.id,
                &drawing.symbol,
                &drawing.interval,
                &drawing.drawing_type,
                &drawing.points,
                &drawing.style,
                drawing.visible as i32,
                drawing.locked as i32,
                now,
                now,
            ],
        ).map_err(|e| format!("Failed to insert drawing: {}", e))?;
    }

    Ok(Drawing {
        updated_at: now,
        created_at: if exists { drawing.created_at } else { now },
        ..drawing
    })
}

/// Get all drawings for a symbol and interval
pub async fn get_drawings(symbol: &str, interval: &str) -> Result<Vec<Drawing>, String> {
    let conn = get_connection()?;
    let conn = conn.lock().await;

    let mut stmt = conn.prepare(
        "SELECT id, symbol, interval, drawing_type, points, style, visible, locked, created_at, updated_at
         FROM drawings WHERE symbol = ? AND interval = ? ORDER BY created_at ASC"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let drawings = stmt.query_map(params![symbol, interval], |row| {
        Ok(Drawing {
            id: row.get(0)?,
            symbol: row.get(1)?,
            interval: row.get(2)?,
            drawing_type: row.get(3)?,
            points: row.get(4)?,
            style: row.get(5)?,
            visible: row.get::<_, i32>(6)? == 1,
            locked: row.get::<_, i32>(7)? == 1,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    }).map_err(|e| format!("Failed to query drawings: {}", e))?;

    let result: Vec<Drawing> = drawings
        .filter_map(|d| d.ok())
        .collect();

    Ok(result)
}

/// Delete a drawing by ID
pub async fn delete_drawing(id: &str) -> Result<bool, String> {
    let conn = get_connection()?;
    let conn = conn.lock().await;

    let rows = conn.execute(
        "DELETE FROM drawings WHERE id = ?",
        params![id],
    ).map_err(|e| format!("Failed to delete drawing: {}", e))?;

    Ok(rows > 0)
}

/// Clear all drawings for a symbol and interval
pub async fn clear_drawings(symbol: &str, interval: &str) -> Result<u64, String> {
    let conn = get_connection()?;
    let conn = conn.lock().await;

    let rows = conn.execute(
        "DELETE FROM drawings WHERE symbol = ? AND interval = ?",
        params![symbol, interval],
    ).map_err(|e| format!("Failed to clear drawings: {}", e))?;

    Ok(rows as u64)
}

/// Get all drawings for a symbol (all intervals)
pub async fn get_all_drawings_for_symbol(symbol: &str) -> Result<Vec<Drawing>, String> {
    let conn = get_connection()?;
    let conn = conn.lock().await;

    let mut stmt = conn.prepare(
        "SELECT id, symbol, interval, drawing_type, points, style, visible, locked, created_at, updated_at
         FROM drawings WHERE symbol = ? ORDER BY interval, created_at ASC"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let drawings = stmt.query_map(params![symbol], |row| {
        Ok(Drawing {
            id: row.get(0)?,
            symbol: row.get(1)?,
            interval: row.get(2)?,
            drawing_type: row.get(3)?,
            points: row.get(4)?,
            style: row.get(5)?,
            visible: row.get::<_, i32>(6)? == 1,
            locked: row.get::<_, i32>(7)? == 1,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    }).map_err(|e| format!("Failed to query drawings: {}", e))?;

    let result: Vec<Drawing> = drawings
        .filter_map(|d| d.ok())
        .collect();

    Ok(result)
}
