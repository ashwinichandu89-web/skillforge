import {
  Award, BookOpen, Bookmark, Brain, Briefcase, CalendarCheck, Cloud, Code2, Database, FileText, Flame, Footprints,
  Github, GraduationCap, Globe, Hourglass, Layers, Mountain, Plug, Puzzle, Target, Trophy, Youtube, Zap, Clock,
  type LucideIcon,
} from 'lucide-react';
import type { ResourceKind } from '../types';

/** The API sends icon names as strings (see backend catalog/achievement seeds); this maps them to components. */
const BY_NAME: Record<string, LucideIcon> = {
  // categories
  code: Code2, globe: Globe, database: Database, cloud: Cloud, brain: Brain, briefcase: Briefcase,
  // achievements
  footprints: Footprints, flame: Flame, mountain: Mountain, puzzle: Puzzle, target: Target, plug: Plug, layers: Layers,
  'calendar-check': CalendarCheck, zap: Zap, clock: Clock, hourglass: Hourglass, trophy: Trophy, award: Award,
};

export function NamedIcon({ name, className = 'h-5 w-5', style }: { name: string; className?: string; style?: Record<string, unknown> }) {
  const Icon = BY_NAME[name] ?? BookOpen;
  return <Icon className={className} style={style} aria-hidden />;
}

const KIND_ICON: Record<ResourceKind, LucideIcon> = {
  youtube: Youtube, docs: BookOpen, github: Github, course: GraduationCap, pdf: FileText, reference: Bookmark,
};

export function KindIcon({ kind, className = 'h-4 w-4' }: { kind: ResourceKind; className?: string }) {
  const Icon = KIND_ICON[kind] ?? Bookmark;
  return <Icon className={className} aria-hidden />;
}
