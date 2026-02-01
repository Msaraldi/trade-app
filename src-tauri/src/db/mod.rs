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
    #[serde(default)]
    pub name: Option<String>,       // Custom name for the drawing
    #[serde(default)]
    pub group_id: Option<String>,   // Group/folder ID
}

/// Drawing group/folder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrawingGroup {
    pub id: String,
    pub name: String,
    pub symbol: String,
    pub color: Option<String>,
    pub visible: bool,
    pub collapsed: bool,
    pub created_at: i64,
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
            updated_at INTEGER NOT NULL,
            name TEXT,
            group_id TEXT
        )",
        [],
    ).map_err(|e| format!("Failed to create drawings table: {}", e))?;

    // Add name and group_id columns if they don't exist (migration for existing databases)
    let _ = conn.execute("ALTER TABLE drawings ADD COLUMN name TEXT", []);
    let _ = conn.execute("ALTER TABLE drawings ADD COLUMN group_id TEXT", []);

    // Create drawing groups table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS drawing_groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            symbol TEXT NOT NULL,
            color TEXT,
            visible INTEGER DEFAULT 1,
            collapsed INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL
        )",
        [],
    ).map_err(|e| format!("Failed to create drawing_groups table: {}", e))?;

    // Create index for faster lookups
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_drawings_symbol_interval
         ON drawings(symbol, interval)",
        [],
    ).map_err(|e| format!("Failed to create index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_drawing_groups_symbol
         ON drawing_groups(symbol)",
        [],
    ).map_err(|e| format!("Failed to create groups index: {}", e))?;

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
                points = ?, style = ?, visible = ?, locked = ?, updated_at = ?,
                name = ?, group_id = ?
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
                &drawing.name,
                &drawing.group_id,
                &drawing.id,
            ],
        ).map_err(|e| format!("Failed to update drawing: {}", e))?;
    } else {
        // Insert new drawing
        conn.execute(
            "INSERT INTO drawings (id, symbol, interval, drawing_type, points, style, visible, locked, created_at, updated_at, name, group_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
                &drawing.name,
                &drawing.group_id,
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
        "SELECT id, symbol, interval, drawing_type, points, style, visible, locked, created_at, updated_at, name, group_id
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
            name: row.get(10).ok(),
            group_id: row.get(11).ok(),
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
        "SELECT id, symbol, interval, drawing_type, points, style, visible, locked, created_at, updated_at, name, group_id
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
            name: row.get(10).ok(),
            group_id: row.get(11).ok(),
        })
    }).map_err(|e| format!("Failed to query drawings: {}", e))?;

    let result: Vec<Drawing> = drawings
        .filter_map(|d| d.ok())
        .collect();

    Ok(result)
}

// ============================================
// DRAWING GROUP OPERATIONS
// ============================================

/// Create a new drawing group
pub async fn create_drawing_group(group: DrawingGroup) -> Result<DrawingGroup, String> {
    let conn = get_connection()?;
    let conn = conn.lock().await;

    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO drawing_groups (id, name, symbol, color, visible, collapsed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            &group.id,
            &group.name,
            &group.symbol,
            &group.color,
            group.visible as i32,
            group.collapsed as i32,
            now,
        ],
    ).map_err(|e| format!("Failed to create group: {}", e))?;

    Ok(DrawingGroup {
        created_at: now,
        ..group
    })
}

/// Get all drawing groups for a symbol
pub async fn get_drawing_groups(symbol: &str) -> Result<Vec<DrawingGroup>, String> {
    let conn = get_connection()?;
    let conn = conn.lock().await;

    let mut stmt = conn.prepare(
        "SELECT id, name, symbol, color, visible, collapsed, created_at
         FROM drawing_groups WHERE symbol = ? ORDER BY created_at ASC"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let groups = stmt.query_map(params![symbol], |row| {
        Ok(DrawingGroup {
            id: row.get(0)?,
            name: row.get(1)?,
            symbol: row.get(2)?,
            color: row.get(3).ok(),
            visible: row.get::<_, i32>(4)? == 1,
            collapsed: row.get::<_, i32>(5)? == 1,
            created_at: row.get(6)?,
        })
    }).map_err(|e| format!("Failed to query groups: {}", e))?;

    let result: Vec<DrawingGroup> = groups
        .filter_map(|g| g.ok())
        .collect();

    Ok(result)
}

/// Update a drawing group
pub async fn update_drawing_group(group: DrawingGroup) -> Result<DrawingGroup, String> {
    let conn = get_connection()?;
    let conn = conn.lock().await;

    conn.execute(
        "UPDATE drawing_groups SET name = ?, color = ?, visible = ?, collapsed = ? WHERE id = ?",
        params![
            &group.name,
            &group.color,
            group.visible as i32,
            group.collapsed as i32,
            &group.id,
        ],
    ).map_err(|e| format!("Failed to update group: {}", e))?;

    Ok(group)
}

/// Delete a drawing group (drawings in group become ungrouped)
pub async fn delete_drawing_group(id: &str) -> Result<bool, String> {
    let conn = get_connection()?;
    let conn = conn.lock().await;

    // First, ungroup all drawings in this group
    conn.execute(
        "UPDATE drawings SET group_id = NULL WHERE group_id = ?",
        params![id],
    ).map_err(|e| format!("Failed to ungroup drawings: {}", e))?;

    // Then delete the group
    let rows = conn.execute(
        "DELETE FROM drawing_groups WHERE id = ?",
        params![id],
    ).map_err(|e| format!("Failed to delete group: {}", e))?;

    Ok(rows > 0)
}

/// Toggle visibility for all drawings in a group
pub async fn toggle_group_visibility(group_id: &str, visible: bool) -> Result<(), String> {
    let conn = get_connection()?;
    let conn = conn.lock().await;

    // Update group visibility
    conn.execute(
        "UPDATE drawing_groups SET visible = ? WHERE id = ?",
        params![visible as i32, group_id],
    ).map_err(|e| format!("Failed to update group visibility: {}", e))?;

    // Update all drawings in the group
    conn.execute(
        "UPDATE drawings SET visible = ? WHERE group_id = ?",
        params![visible as i32, group_id],
    ).map_err(|e| format!("Failed to update drawings visibility: {}", e))?;

    Ok(())
}

/// Move a drawing to a group
pub async fn move_drawing_to_group(drawing_id: &str, group_id: Option<&str>) -> Result<(), String> {
    let conn = get_connection()?;
    let conn = conn.lock().await;

    conn.execute(
        "UPDATE drawings SET group_id = ? WHERE id = ?",
        params![group_id, drawing_id],
    ).map_err(|e| format!("Failed to move drawing: {}", e))?;

    Ok(())
}
