import sqlite3
import os
import time

def get_iceland_volcanoes():
    """Provides manual volcano data for Iceland."""
    return [
        {
            "name": "Öræfajökull",
            "description": "Öræfajökull is the largest active volcano in Iceland.",
            "elevation_m": 2110.0,
            "elevation_ft": 6923.0,
            "latitude": 64.00,
            "longitude": -16.65,
            "last_eruption": "1728"
        },
        {
            "name": "Bárðarbunga",
            "description": "Bárðarbunga is a stratovolcano located under Vatnajökull glacier.",
            "elevation_m": 2005.0,
            "elevation_ft": 6515.0,
            "latitude": 64.64,
            "longitude": -17.56,
            "last_eruption": "2014-2015"
        },
        {
            "name": "Eyjafjallajökull",
            "description": "Eyjafjallajökull is a stratovolcano completely covered by an ice cap.",
            "elevation_m": 1651.0,
            "elevation_ft": 5417.0,
            "latitude": 63.63,
            "longitude": -19.62,
            "last_eruption": "2010"
        },
        {
            "name": "Grímsvötn",
            "description": "Grímsvötn is Iceland's most frequently active volcano in historical time.",
            "elevation_m": 1725.0,
            "elevation_ft": 5659.0,
            "latitude": 64.42,
            "longitude": -17.33,
            "last_eruption": "2022"
        },
        {
            "name": "Hekla",
            "description": "Hekla is one of Iceland's most active volcanoes, located in the south of the country.",
            "elevation_m": 1488.0,
            "elevation_ft": 4882.0,
            "latitude": 63.98,
            "longitude": -19.70,
            "last_eruption": "2000"
        },
        {
            "name": "Katla",
            "description": "Katla is a large volcano in southern Iceland covered by the Mýrdalsjökull glacier.",
            "elevation_m": 1512.0,
            "elevation_ft": 4961.0,
            "latitude": 63.63,
            "longitude": -19.05,
            "last_eruption": "1918"
        }
    ]

def save_volcanoes_to_db(volcanoes, db_path=None):
    """
    Save the volcano data to the SQLite database.
    
    Args:
        volcanoes: List of volcano dictionaries
        db_path: Optional path to the database file. If None, will use default location.
    """
    # If db_path is not provided, determine the default path
    if db_path is None:
        # Get the path of the current script file
        current_file_path = os.path.dirname(os.path.abspath(__file__))
        
        # Define the data directory path relative to this file
        db_dir = os.path.join(current_file_path, "data")
        os.makedirs(db_dir, exist_ok=True)
        
        # Define the database path
        db_path = os.path.join(db_dir, "earthquakes.db")
    
    print(f"Connecting to database at: {db_path}")
    
    try:
        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create the volcanoes table if it doesn't exist
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS volcano (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            elevation_m FLOAT,
            elevation_ft FLOAT,
            latitude FLOAT,
            longitude FLOAT,
            last_eruption TEXT,
            UNIQUE(name, latitude, longitude)
        )
        ''')
        
        # Clear existing data
        cursor.execute('DELETE FROM volcano')
        
        # Insert volcano data
        for volcano in volcanoes:
            try:
                cursor.execute('''
                INSERT OR REPLACE INTO volcano 
                (name, description, elevation_m, elevation_ft, latitude, longitude, last_eruption)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    volcano['name'],
                    volcano['description'],
                    volcano['elevation_m'],
                    volcano['elevation_ft'],
                    volcano['latitude'],
                    volcano['longitude'],
                    volcano['last_eruption']
                ))
            except Exception as e:
                print(f"Error inserting volcano {volcano['name']}: {e}")
        
        # Commit and close
        conn.commit()
        conn.close()
        
        print(f"✓ {len(volcanoes)} volcanoes saved to database.")
        return True
    except Exception as e:
        print(f"Database error: {e}")
        return False

def verify_db_data(db_path=None):
    """
    Verify data was saved correctly by reading from the database.
    
    Args:
        db_path: Optional path to the database file. If None, will use default location.
    """
    # If db_path is not provided, determine the default path
    if db_path is None:
        # Get the path of the current script file
        current_file_path = os.path.dirname(os.path.abspath(__file__))
        
        # Define the data directory path relative to this file
        db_dir = os.path.join(current_file_path, "data")
        
        # Define the database path
        db_path = os.path.join(db_dir, "earthquakes.db")
    
    try:
        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Count records
        cursor.execute('SELECT COUNT(*) FROM volcano')
        count = cursor.fetchone()[0]
        
        # Get sample data
        cursor.execute('SELECT * FROM volcano LIMIT 3')
        sample = cursor.fetchall()
        
        conn.close()
        
        print(f"Database contains {count} volcano records.")
        if sample:
            print("Sample data:")
            for row in sample:
                print(row)
        
        return count > 0
    except Exception as e:
        print(f"Error verifying data: {e}")
        return False

if __name__ == "__main__":
    print("Starting volcano data population...")
    volcanoes = get_iceland_volcanoes()
    
    if not volcanoes:
        print("No volcano data available.")
    else:
        print(f"Loaded {len(volcanoes)} volcanoes.")
        
        print("Saving data to database...")
        if save_volcanoes_to_db(volcanoes):
            print("Data saved successfully.")
            
            # Verify data was saved
            print("Verifying data in database...")
            time.sleep(1)  # Small delay to ensure transaction is complete
            if verify_db_data():
                print("Verification successful!")
            else:
                print("Verification failed - database may be empty.")
        else:
            print("Failed to save data to database.")