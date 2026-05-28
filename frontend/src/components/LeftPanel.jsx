import { useState } from 'react';
import MapTypeSelector from './MapTypeSelector';
import TimeWindowSlider from './TimeWindowSlider';
import './LeftPanel.css';

const LeftPanel = ({
  mapType,
  onMapTypeChange,
  showVolcanoes,
  toggleVolcanoes,
  showGrid,
  onShowGridChange,
  showTectonicZones,
  onShowTectonicZonesChange,
  colorOwner,
  onChangeColorOwner,
  isHeatmap,
  onFilterChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`left-panel${collapsed ? ' left-panel--collapsed' : ''}`}>
      {/* White sidebar body */}
      <div className="left-panel__drawer">
        <div className="left-panel__body">
          <div className="left-panel__section">
            <MapTypeSelector onMapTypeChange={onMapTypeChange} />
          </div>

          {!isHeatmap && (
            <div className="left-panel__section">
              <span className="left-panel__label">Marker colour</span>
              <div className="color-mode-switch">
                <button
                  className={colorOwner === 'timeline' ? 'active' : ''}
                  onClick={() => onChangeColorOwner('timeline')}
                >
                  Timeline
                </button>
                <button
                  className={colorOwner === 'magnitude' ? 'active' : ''}
                  onClick={() => onChangeColorOwner('magnitude')}
                >
                  Magnitude
                </button>
              </div>
            </div>
          )}

          <div className="left-panel__section">
            <span className="left-panel__label">Overlays</span>
            <div className="volcano-toggle">
              <label className="switch">
                <input type="checkbox" checked={showVolcanoes} onChange={toggleVolcanoes} />
                <span className="slider round"></span>
              </label>
              <span className="toggle-label">Show volcanoes</span>
            </div>
            <div className="volcano-toggle grid-toggle">
              <label className="switch">
                <input type="checkbox" checked={showGrid} onChange={onShowGridChange} />
                <span className="slider round"></span>
              </label>
              <span className="toggle-label">Show lat-lon grid</span>
            </div>
            {!isHeatmap && (
              <div className="volcano-toggle tectonic-toggle">
                <label className="switch">
                  <input type="checkbox" checked={showTectonicZones} onChange={onShowTectonicZonesChange} />
                  <span className="slider round"></span>
                </label>
                <span className="toggle-label">Tectonic zones</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapse / expand tab */}
      <button
        className="left-panel__toggle"
        onClick={() => setCollapsed(v => !v)}
        title={collapsed ? 'Show controls' : 'Hide controls'}
      >
        {collapsed ? '▶' : '◀'}
      </button>

      {/* Time window slider: keeps its original vertical floating layout,
          hidden alongside the rest of the panel when collapsed */}
      {!collapsed && (
        <TimeWindowSlider
          onFilterChange={onFilterChange}
          colorOwner={colorOwner}
          vertical
          isHeatmap={isHeatmap}
        />
      )}
    </div>
  );
};

export default LeftPanel;
