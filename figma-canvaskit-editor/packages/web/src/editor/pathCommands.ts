export type PathCommandType = 'M' | 'L' | 'C' | 'Q' | 'Z';

export interface PathCommand {
  type: PathCommandType;
  points: number[];
}

export interface ControlPoint {
  pathIndex: number;
  commandIndex: number;
  pointIndex: number;
  kind: 'anchor' | 'control';
  x: number;
  y: number;
}

export function parseSvgPath(d: string): PathCommand[] {
  const tokens = tokenize(d);
  const commands: PathCommand[] = [];
  let cursor = { x: 0, y: 0 };
  let command: string | null = null;
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];
    if (isCommand(token)) {
      command = token;
      index += 1;
      if (command === 'Z' || command === 'z') {
        commands.push({ type: 'Z', points: [] });
        continue;
      }
    }

    if (!command) {
      index += 1;
      continue;
    }

    const type = command.toUpperCase() as PathCommandType;
    const isRelative = command === command.toLowerCase();
    const required = pointsPerCommand(type);
    if (required === 0) {
      continue;
    }
    if (index + required > tokens.length) {
      break;
    }
    const numbers = tokens.slice(index, index + required).map(Number);
    index += required;

    const points = numbers.slice();
    if (isRelative) {
      for (let i = 0; i < points.length; i += 2) {
        points[i] += cursor.x;
        points[i + 1] += cursor.y;
      }
    }

    cursor = { x: points[points.length - 2], y: points[points.length - 1] };
    commands.push({ type, points });

    if (type === 'M') {
      command = isRelative ? 'l' : 'L';
    }
  }

  return commands;
}

export function serializeSvgPath(commands: PathCommand[]): string {
  return commands
    .map((command) => {
      if (command.type === 'Z') {
        return 'Z';
      }
      return `${command.type}${command.points.join(' ')}`;
    })
    .join(' ');
}

export function getControlPoints(pathIndex: number, commands: PathCommand[]): ControlPoint[] {
  const points: ControlPoint[] = [];
  commands.forEach((command, commandIndex) => {
    switch (command.type) {
      case 'M':
      case 'L':
        points.push({
          pathIndex,
          commandIndex,
          pointIndex: command.points.length - 2,
          kind: 'anchor',
          x: command.points[command.points.length - 2],
          y: command.points[command.points.length - 1],
        });
        break;
      case 'Q':
        points.push({
          pathIndex,
          commandIndex,
          pointIndex: 0,
          kind: 'control',
          x: command.points[0],
          y: command.points[1],
        });
        points.push({
          pathIndex,
          commandIndex,
          pointIndex: 2,
          kind: 'anchor',
          x: command.points[2],
          y: command.points[3],
        });
        break;
      case 'C':
        points.push({
          pathIndex,
          commandIndex,
          pointIndex: 0,
          kind: 'control',
          x: command.points[0],
          y: command.points[1],
        });
        points.push({
          pathIndex,
          commandIndex,
          pointIndex: 2,
          kind: 'control',
          x: command.points[2],
          y: command.points[3],
        });
        points.push({
          pathIndex,
          commandIndex,
          pointIndex: 4,
          kind: 'anchor',
          x: command.points[4],
          y: command.points[5],
        });
        break;
      default:
        break;
    }
  });
  return points;
}

export function updateControlPoint(commands: PathCommand[], control: ControlPoint, x: number, y: number): PathCommand[] {
  const updated = commands.map((command) => ({ ...command, points: command.points.slice() }));
  const target = updated[control.commandIndex];
  if (!target) return updated;
  if (target.points.length <= control.pointIndex + 1) return updated;
  target.points[control.pointIndex] = x;
  target.points[control.pointIndex + 1] = y;
  return updated;
}

function tokenize(d: string): string[] {
  const tokens: string[] = [];
  const regex = /[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(d)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

function isCommand(token: string) {
  return /[a-zA-Z]/.test(token);
}

function pointsPerCommand(type: PathCommandType): number {
  switch (type) {
    case 'M':
    case 'L':
      return 2;
    case 'Q':
      return 4;
    case 'C':
      return 6;
    default:
      return 0;
  }
}
