import type { DramaPlugin, FilterPlugin, ModePlugin, DetectorPlugin, StylePlugin } from './types';

export class PluginRegistry {
  private readonly modeList = new Map<string, ModePlugin>();
  private readonly styleList = new Map<string, StylePlugin>();
  private readonly filterList = new Map<string, FilterPlugin>();
  private readonly detectorList = new Map<string, DetectorPlugin>();

  register(plugin: DramaPlugin): void {
    plugin.modes?.forEach(mode => this.modeList.set(mode.id, mode));
    plugin.styles?.forEach(style => this.styleList.set(style.id, style));
    plugin.filters?.forEach(filter => this.filterList.set(filter.id, filter));
    plugin.detectors?.forEach(detector => this.detectorList.set(detector.id, detector));
  }

  modes(): ModePlugin[] { return [...this.modeList.values()]; }
  styles(): StylePlugin[] { return [...this.styleList.values()]; }
  filters(): FilterPlugin[] { return [...this.filterList.values()]; }
  detectors(): DetectorPlugin[] { return [...this.detectorList.values()]; }

  filter(id: string): FilterPlugin | null { return this.filterList.get(id) ?? null; }
  detector(id: string): DetectorPlugin | null { return this.detectorList.get(id) ?? null; }
  mode(id: string): ModePlugin | null { return this.modeList.get(id) ?? null; }
  style(id: string): StylePlugin | null { return this.styleList.get(id) ?? null; }

  reset(): void {
    this.modeList.clear();
    this.styleList.clear();
    this.filterList.clear();
    this.detectorList.clear();
  }
}

export const pluginRegistry = new PluginRegistry();
