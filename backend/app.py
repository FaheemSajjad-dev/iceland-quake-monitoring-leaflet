from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from apscheduler.schedulers.background import BackgroundScheduler
import os

app = Flask(__name__)
CORS(app)

# Get the path of the current script file
CURRENT_FILE_PATH = os.path.dirname(os.path.abspath(__file__))

# Define the data directory path relative to this file
DB_DIR = os.path.join(CURRENT_FILE_PATH, "data")
os.makedirs(DB_DIR, exist_ok=True)

# Define the database path
DB_PATH = os.path.join(DB_DIR, "earthquakes.db")

print(f"Using database at: {DB_PATH}")

# Configure SQLite Database with Thread Safety
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_size": 5, "pool_recycle": 280}

db = SQLAlchemy(app)

class Earthquake(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date_time = db.Column(db.String, nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    depth = db.Column(db.Float, nullable=False)
    mw_mean = db.Column(db.Float, nullable=False)
    
    __table_args__ = (
        db.UniqueConstraint('date_time', 'latitude', 'longitude', name='unique_earthquake_entry'),
    )

class Volcano(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    description = db.Column(db.Text)
    elevation_m = db.Column(db.Float)
    elevation_ft = db.Column(db.Float)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    last_eruption = db.Column(db.String)
    
    __table_args__ = (
        db.UniqueConstraint('name', 'latitude', 'longitude', name='unique_volcano_entry'),
    )

def create_tables():
    """Ensures the database tables are created before running the app."""
    with app.app_context():
        db.create_all()

# Ensure database is created before running the scheduler
create_tables()

def scheduled_scrape():
    """Scrape earthquake data every 3 minutes and store only new records in SQLite."""
    with app.app_context():
        # Import here to avoid circular import
        import sys
        sys.path.append(CURRENT_FILE_PATH)
        from scrape import scrape_all_earthquake_data
        scrape_all_earthquake_data()

# Initialize and start APScheduler after ensuring SQLAlchemy is ready
scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_scrape, "interval", minutes=3)
scheduler.start()

@app.route('/earthquakes', methods=['GET'])
def get_earthquake_data():
    """Returns earthquake data from the database as JSON."""
    with app.app_context():
        quakes = Earthquake.query.order_by(Earthquake.date_time.desc()).all()
        return jsonify([
            {
                "Date-time": q.date_time,
                "Latitude": q.latitude,
                "Longitude": q.longitude,
                "Depth": q.depth,
                "Mw_mean": q.mw_mean
            }
            for q in quakes
        ])

@app.route('/volcanoes', methods=['GET'])
def get_volcano_data():
    """Returns volcano data from the database as JSON."""
    with app.app_context():
        volcanoes = Volcano.query.all()
        return jsonify([
            {
                "name": v.name,
                "description": v.description,
                "elevation_m": v.elevation_m,
                "elevation_ft": v.elevation_ft,
                "latitude": v.latitude,
                "longitude": v.longitude,
                "last_eruption": v.last_eruption
            }
            for v in volcanoes
        ])

@app.route('/')
def home():
    return jsonify({"message": "Iceland Earthquake Monitoring API is running!"})

@app.route('/scrape-volcanoes', methods=['GET'])
def scrape_volcanoes():
    """Endpoint to trigger volcano data scraping."""
    try:
        # Import here to avoid circular import
        import sys
        sys.path.append(CURRENT_FILE_PATH)
        from volcano_scraper import get_iceland_volcanoes, save_volcanoes_to_db
        volcanoes = get_iceland_volcanoes()
        if volcanoes:
            save_volcanoes_to_db(volcanoes, DB_PATH)  # Pass DB_PATH explicitly
            return jsonify({"message": f"Successfully retrieved {len(volcanoes)} volcanoes."})
        else:
            return jsonify({"message": "No volcano data was found."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/deep-earthquakes', methods=['GET'])
def get_deep_earthquakes():
    """Returns earthquakes with depth >= 25km from the database as JSON, ordered by depth in descending order."""
    with app.app_context():
        deep_quakes = Earthquake.query.filter(Earthquake.depth >= 25).order_by(Earthquake.depth.desc()).all()
        result = [
            {
                "Date-time": q.date_time,
                "Latitude": q.latitude,
                "Longitude": q.longitude,
                "Depth": q.depth,
                "Mw_mean": q.mw_mean
            }
            for q in deep_quakes
        ]
        
        return jsonify({
            "count": len(result),
            "earthquakes": result
        })

if __name__ == '__main__':
    print(f"Starting server with database at: {DB_PATH}")
    app.run(debug=True)