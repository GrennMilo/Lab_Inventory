from flask import Flask, render_template, send_from_directory, jsonify, request
import os
import json
from datetime import datetime
import uuid
import shutil

app = Flask(__name__)

# Ensure static folder is properly configured
app.static_folder = 'static'

# Define the path for the primary inventory file
INVENTORY_FILE = os.path.join('reports', 'current_inventory.json')
HISTORY_FILE = os.path.join('reports', 'edit_history.json')

# Helper function to ensure directories exist
def ensure_directories():
    os.makedirs('reports', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)

# Helper function to load inventory data
def load_inventory():
    ensure_directories()
    
    if not os.path.exists(INVENTORY_FILE):
        # Create an empty inventory if it doesn't exist
        with open(INVENTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump({"items": []}, f, ensure_ascii=False, indent=2)
        return {"items": []}
    
    try:
        with open(INVENTORY_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data
    except Exception as e:
        app.logger.error(f"Error loading inventory: {str(e)}")
        return {"items": []}

# Helper function to save inventory data
def save_inventory(data):
    ensure_directories()
    
    # Create a backup before saving
    if os.path.exists(INVENTORY_FILE):
        backup_file = os.path.join('reports', f"backup_inventory_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        shutil.copy2(INVENTORY_FILE, backup_file)
    
    try:
        with open(INVENTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        app.logger.error(f"Error saving inventory: {str(e)}")
        return False

# Helper function to record an edit in the history
def record_edit(action, items, user="Sistema"):
    ensure_directories()
    
    if not os.path.exists(HISTORY_FILE):
        history = {"edits": []}
    else:
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                history = json.load(f)
        except Exception:
            history = {"edits": []}
    
    # Add new edit record
    edit_record = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(),
        "action": action,
        "user": user,
        "itemCount": len(items) if isinstance(items, list) else 1,
        "items": items
    }
    
    history["edits"].append(edit_record)
    
    # Save history file
    try:
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        app.logger.error(f"Error recording edit history: {str(e)}")
        return False

@app.route('/')
def index():
    """Render the main laboratory inventory page"""
    return render_template('labinventory.html')

@app.route('/css/<path:filename>')
def css_files(filename):
    """Serve CSS files"""
    return send_from_directory('static/css', filename)

@app.route('/js/<path:filename>')
def js_files(filename):
    """Serve JavaScript files"""
    return send_from_directory('static/js', filename)

@app.route('/api/health')
def health_check():
    """Simple health check endpoint"""
    return jsonify({"status": "ok", "message": "Lab Inventory System is running"})

@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    """Get the current inventory data"""
    inventory = load_inventory()
    return jsonify(inventory)

@app.route('/api/inventory', methods=['POST'])
def update_inventory():
    """Update the entire inventory"""
    try:
        data = request.json
        if not data or "items" not in data:
            return jsonify({"status": "error", "message": "Invalid data format"}), 400
        
        # Save the inventory
        if save_inventory(data):
            # Record the edit
            record_edit("update_all", data["items"])
            return jsonify({"status": "success", "message": "Inventory updated successfully"})
        else:
            return jsonify({"status": "error", "message": "Failed to save inventory"}), 500
    
    except Exception as e:
        app.logger.error(f"Error updating inventory: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500

@app.route('/api/inventory/item', methods=['POST'])
def add_item():
    """Add a new item to the inventory"""
    try:
        item = request.json
        if not item:
            return jsonify({"status": "error", "message": "Invalid item data"}), 400
        
        # Add metadata if not present
        if "dataModifica" not in item:
            item["dataModifica"] = datetime.now().strftime("%d/%m/%Y")
        
        # Load current inventory
        inventory = load_inventory()
        
        # Add the item
        inventory["items"].append(item)
        
        # Save inventory
        if save_inventory(inventory):
            # Record the edit
            record_edit("add_item", item)
            return jsonify({"status": "success", "message": "Item added successfully", "item": item})
        else:
            return jsonify({"status": "error", "message": "Failed to save inventory"}), 500
    
    except Exception as e:
        app.logger.error(f"Error adding item: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500

@app.route('/api/inventory/item/<item_id>', methods=['PUT'])
def update_item(item_id):
    """Update an existing item"""
    try:
        updated_item = request.json
        if not updated_item:
            return jsonify({"status": "error", "message": "Invalid item data"}), 400
        
        # Update modification date
        updated_item["dataModifica"] = datetime.now().strftime("%d/%m/%Y")
        
        # Load current inventory
        inventory = load_inventory()
        
        # Find and update the item
        found = False
        for i, item in enumerate(inventory["items"]):
            if item.get("codiceArticolo") == item_id:
                # Save original for history
                original_item = inventory["items"][i].copy()
                
                # Update the item
                inventory["items"][i] = updated_item
                found = True
                break
        
        if not found:
            return jsonify({"status": "error", "message": "Item not found"}), 404
        
        # Save inventory
        if save_inventory(inventory):
            # Record the edit with both the original and updated versions
            record_edit("update_item", {
                "original": original_item,
                "updated": updated_item
            })
            return jsonify({"status": "success", "message": "Item updated successfully", "item": updated_item})
        else:
            return jsonify({"status": "error", "message": "Failed to save inventory"}), 500
    
    except Exception as e:
        app.logger.error(f"Error updating item: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500

@app.route('/api/inventory/item/<item_id>', methods=['DELETE'])
def delete_item(item_id):
    """Delete an item from the inventory"""
    try:
        # Load current inventory
        inventory = load_inventory()
        
        # Find and delete the item
        found = False
        deleted_item = None
        
        for i, item in enumerate(inventory["items"]):
            if item.get("codiceArticolo") == item_id:
                deleted_item = inventory["items"].pop(i)
                found = True
                break
        
        if not found:
            return jsonify({"status": "error", "message": "Item not found"}), 404
        
        # Save inventory
        if save_inventory(inventory):
            # Record the deletion
            record_edit("delete_item", deleted_item)
            return jsonify({"status": "success", "message": "Item deleted successfully"})
        else:
            return jsonify({"status": "error", "message": "Failed to save inventory"}), 500
    
    except Exception as e:
        app.logger.error(f"Error deleting item: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500

@app.route('/api/history', methods=['GET'])
def get_edit_history():
    """Get the edit history"""
    ensure_directories()
    
    if not os.path.exists(HISTORY_FILE):
        return jsonify({"edits": []})
    
    try:
        with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
            history = json.load(f)
        return jsonify(history)
    except Exception as e:
        app.logger.error(f"Error loading history: {str(e)}")
        return jsonify({"status": "error", "message": f"Error: {str(e)}"}), 500

@app.route('/api/save-report', methods=['POST'])
def save_report():
    """Save imported inventory data as JSON report and update the main inventory"""
    try:
        # Get data from request
        data = request.json
        
        # Create reports directory if it doesn't exist
        ensure_directories()
        
        # Generate a filename based on current date and time if not provided
        if not data.get('filename'):
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"inventory_import_{timestamp}.json"
        else:
            filename = data['filename']
        
        # Ensure filename has .json extension
        if not filename.endswith('.json'):
            filename += '.json'
            
        # Full path to save the file
        filepath = os.path.join('reports', filename)
        
        # Add metadata to the report
        report_data = {
            "metadata": {
                "createdAt": datetime.now().isoformat(),
                "itemCount": len(data.get('items', [])),
                "source": "TXT Import"
            },
            "items": data.get('items', [])
        }
        
        # Write JSON file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        
        # Update the main inventory with the new items
        inventory = load_inventory()
        existing_items = inventory.get("items", [])
        
        # Add new items from the report
        for new_item in data.get('items', []):
            # Check if this item already exists
            exists = False
            for existing_item in existing_items:
                if (existing_item.get("oggetto") == new_item.get("oggetto") and
                    existing_item.get("stanza") == new_item.get("stanza") and
                    existing_item.get("zona") == new_item.get("zona") and
                    existing_item.get("ripiano") == new_item.get("ripiano")):
                    exists = True
                    break
            
            if not exists:
                existing_items.append(new_item)
        
        # Save the updated inventory
        inventory["items"] = existing_items
        save_inventory(inventory)
        
        # Record the import action
        record_edit("import", data.get('items', []))
        
        return jsonify({
            "status": "success",
            "message": f"Report saved successfully as {filename}",
            "filepath": filepath
        })
    
    except Exception as e:
        # Log the error
        app.logger.error(f"Error saving report: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Failed to save report: {str(e)}"
        }), 500

@app.route('/reports')
def list_reports():
    """List all available reports"""
    try:
        ensure_directories()
        
        files = [f for f in os.listdir('reports') if f.endswith('.json') and f != 'current_inventory.json' and f != 'edit_history.json']
        files.sort(key=lambda x: os.path.getmtime(os.path.join('reports', x)), reverse=True)
        
        return jsonify({
            "status": "success",
            "reports": files
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/reports/<filename>')
def get_report(filename):
    """Serve a specific report file"""
    try:
        return send_from_directory('reports', filename)
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Report not found: {str(e)}"
        }), 404

if __name__ == '__main__':
    # Ensure required directories exist
    ensure_directories()
    
    # Check if labinventory.css exists, if not create a basic one
    if not os.path.exists('static/css/labinventory.css'):
        with open('static/css/labinventory.css', 'w') as f:
            f.write("""
/* Lab Inventory CSS */
.column-resizer {
    position: absolute;
    right: 0;
    top: 0;
    width: 5px;
    height: 100%;
    cursor: col-resize;
    user-select: none;
}

.column-resizer.resizing {
    background-color: #007bff;
}

.drop-zone {
    border: 2px dashed #ccc;
    border-radius: 5px;
    padding: 25px;
    text-align: center;
    margin-bottom: 20px;
    transition: all 0.3s;
}

.drop-zone.dragover {
    background-color: #f8f9fa;
    border-color: #007bff;
}

.zoom-level-1 .table {
    font-size: 0.7rem;
}

.zoom-level-2 .table {
    font-size: 0.8rem;
}

.zoom-level-3 .table {
    font-size: 0.9rem;
}

.zoom-level-4 .table {
    font-size: 1rem;
}

.zoom-level-5 .table {
    font-size: 1.1rem;
}

.action-buttons {
    white-space: nowrap;
    display: flex;
    justify-content: center;
}
""")
    
    # Start the Flask development server
    app.run(debug=True, host='0.0.0.0', port=5000) 