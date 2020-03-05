import * as vscode from 'vscode'

interface DeltaByAnchor {
  anchor: number
  active: number
}

interface DeltaByPosition {
  start: number
  end: number
}




export class  OffsetRange {
    readonly start: number
    readonly end: number
    readonly length: number
    readonly isEmpty: boolean

    constructor(start: number, end: number) {
      if (start < end) {
        this.start = start
        this.end   = end
      } else {
        this.start = end
        this.end   = start
      }
      this.length = this.end - this.start
      this.isEmpty = (start === end)
    }

    translate(delta: number) {
      if (delta === 0) {
        return this
      } else {
        return new OffsetRange(
                    this.start + delta,
                    this.end + delta
                   )
      }
    }

    shift(delta: DeltaByPosition) {
      if (delta.start === 0 && delta.end === 0) {
        return this
      } else {
        return new OffsetRange(
                    this.start + delta.start,
                    this.end + delta.end
                   )
      }
    }

    shiftEnd(delta: number) {
      return this.shift({ start: 0, end: delta})
    }

    shiftStart(delta: number) {
      return this.shift({ start: delta, end: 0})
    }

    contains(other: OffsetRange) {
      return ((this.start <= other.start) && (this.end >= other.end))
    }

    union(other: OffsetRange) {
      return new OffsetRange(Math.min(this.start, other.start), Math.max(this.end, other.end))
    }

    intersects(other: OffsetRange) {
      return (
         (this.start  <= other.start && this.end  >= other.start) ||
         (other.start <= this.start  && other.end >= this.start)
        ) 
    }

    intersection(other: OffsetRange): OffsetRange | undefined {
      if (this.intersects(other)) {
        return new OffsetRange(Math.max(this.start, other.start), Math.min(this.end, other.end))
      }
      return undefined
    }

    isEqual(other: OffsetRange) {
      return (this.start === other.start && this.end === other.end)
    }

    toString() {
      return `<OffsetRange>[${this.start}, ${this.end}]`
    }
}


export enum OffsetEdgeTransformationBehaviour {
    Inclusive = 0, // Default
    ExclusiveStart = 1 << 0,
    ExclusiveEnd = 1 << 1,
}

export class OffsetSelection extends OffsetRange {
    anchor: number
    active: number
    transformationBehaviour: OffsetEdgeTransformationBehaviour
    readonly isReversed: boolean
    readonly isEmpty: boolean

    constructor(anchor: number, active: number, transformationBehaviour: OffsetEdgeTransformationBehaviour = OffsetEdgeTransformationBehaviour.ExclusiveStart) {
      super(anchor, active)
      this.anchor = anchor
      this.active = active
      this.isReversed = (active < anchor)
      this.isEmpty = (active === anchor)
      this.transformationBehaviour = transformationBehaviour
    }

    translateSelection(delta: number) {
      if (delta === 0) {
        return this
      } else {
        return new OffsetSelection(
                    this.anchor + delta,
                    this.active + delta
                   )
      }
    }



    shiftSelectionByAnchors(delta: DeltaByAnchor): OffsetSelection {
      if (delta.anchor === 0 && delta.active === 0) {
        return this
      } else {
        return new OffsetSelection(
                    this.anchor + delta.anchor,
                    this.active + delta.active
                   )
      }
    }

    shiftSelectionByPositions(delta: DeltaByPosition): OffsetSelection {
      if (delta.start === 0 && delta.end === 0) {
        return this
      } else {
        return (this.isReversed
                ? new OffsetSelection(
                      this.active + delta.start,
                      this.anchor + delta.end,
                     )
                : new OffsetSelection(
                      this.anchor + delta.start,
                      this.active + delta.end
                     )
        )
      }
    }

    shiftSelection(delta: DeltaByAnchor | DeltaByPosition) {
      if (delta as DeltaByAnchor) {
        return this.shiftSelectionByAnchors(<DeltaByAnchor>delta)
      } else {
        return this.shiftSelectionByPositions(<DeltaByPosition>delta)
      }
    }

    shiftActive(delta: number) {
      if (delta === 0) {
        return this
      } else {
        return new OffsetSelection(
                    this.anchor,
                    this.active + delta
                   )
      }
    }

    shiftAnchor(delta: number) {
      if (delta === 0) {
        return this
      } else {
        return new OffsetSelection(
                    this.anchor + delta,
                    this.active
                   )
      }
    }

    shiftSelectionEnd(delta: number) {
      return ( this.isReversed
        ? this.shiftAnchor(delta)
        : this.shiftActive(delta)
      )
    }

    shiftSelectionStart(delta: number) {
      return ( this.isReversed
        ? this.shiftActive(delta)
        : this.shiftAnchor(delta)
      )
    }

    isEqual(other: OffsetSelection) {
      return (this.anchor === other.anchor && this.active === other.active)
    }

    toVSCodeSelection(document: vscode.TextDocument) {
      return new vscode.Selection(document.positionAt(this.anchor), document.positionAt(this.active))
    }

    remove(other: OffsetRange): OffsetSelection | undefined {
      if (other.isEmpty) {
        return this
      }
      if (other.contains(this)) {
        return undefined
      }
      else {
        const int = this.intersection(other)
        const shiftBefore = (other.start <= this.start
                            ? (other.length - (int ? int.length : 0))
                            : 0)
        const shiftAfter  = (int ? int.length : 0)
        return this.shiftSelectionByPositions({start: shiftBefore * -1, end: (shiftBefore+shiftAfter) * -1})
      }
    }
    
    getTransformationBehaviour() {
      return this.transformationBehaviour
    }
    
    setTransformationBehaviour(transformationBehaviour: OffsetEdgeTransformationBehaviour) {
      this.transformationBehaviour = transformationBehaviour
    }

    insert(offset: number, length: number, transformationBehaviour: OffsetEdgeTransformationBehaviour | undefined = OffsetEdgeTransformationBehaviour.ExclusiveStart): OffsetSelection {
      if (transformationBehaviour === undefined) transformationBehaviour = this.transformationBehaviour
      
      if ((transformationBehaviour & OffsetEdgeTransformationBehaviour.ExclusiveEnd) ? offset >= this.end : offset > this.end) {
        return this
      }
      else if ( (transformationBehaviour & OffsetEdgeTransformationBehaviour.ExclusiveStart) ? offset <= this.start : offset < this.start) {
        return this.translateSelection(length)
      } else {
        return this.shiftSelectionEnd(length)
      }
    }

    removeAndInsert(other: OffsetRange, length: number, transformationBehaviour: OffsetEdgeTransformationBehaviour | undefined = OffsetEdgeTransformationBehaviour.ExclusiveStart): OffsetSelection | undefined {
      if (transformationBehaviour === undefined) transformationBehaviour = this.transformationBehaviour
      
      const removeMaybe = this.remove(other)
      if (removeMaybe) {
        return removeMaybe.insert(other.start, length, transformationBehaviour)
      }
      return undefined
    }

    toString() {
      return `<OffsetSelection>{ anchor: ${this.anchor}, active: ${this.active}}`
    }
}
