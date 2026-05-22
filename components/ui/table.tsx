'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'

type SortDirection = 'asc' | 'desc'
type TableSortState = { columnIndex: number; direction: SortDirection } | null

type TableContextValue = {
  sort: TableSortState
  toggleSort: (columnIndex: number) => void
}

const TableContext = React.createContext<TableContextValue | null>(null)
const TableHeaderContext = React.createContext(false)

function isElementWithChildren(
  node: React.ReactNode,
): node is React.ReactElement<{ children?: React.ReactNode; colSpan?: number }> {
  return React.isValidElement(node)
}

function getNodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return ''
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join(' ')
  }

  if (isElementWithChildren(node)) {
    return getNodeText(node.props.children)
  }

  return ''
}

function normalizeSortValue(rawValue: string) {
  const value = rawValue.replace(/\s+/g, ' ').trim()

  if (!value) {
    return { kind: 'empty' as const, value: '' }
  }

  const dateMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (dateMatch) {
    const [, day, month, year, hour = '0', minute = '0'] = dateMatch
    const timestamp = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    ).getTime()

    if (!Number.isNaN(timestamp)) {
      return { kind: 'number' as const, value: timestamp }
    }
  }

  const numberCandidate = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')

  if (numberCandidate && /^-?\d+(\.\d+)?$/.test(numberCandidate)) {
    const numericValue = Number(numberCandidate)
    if (!Number.isNaN(numericValue)) {
      return { kind: 'number' as const, value: numericValue }
    }
  }

  return { kind: 'text' as const, value: value.toLocaleLowerCase('pt-BR') }
}

function compareSortValues(left: string, right: string) {
  const normalizedLeft = normalizeSortValue(left)
  const normalizedRight = normalizeSortValue(right)

  if (normalizedLeft.kind === 'empty' && normalizedRight.kind !== 'empty') {
    return 1
  }

  if (normalizedRight.kind === 'empty' && normalizedLeft.kind !== 'empty') {
    return -1
  }

  if (normalizedLeft.kind === 'number' && normalizedRight.kind === 'number') {
    return normalizedLeft.value - normalizedRight.value
  }

  return String(normalizedLeft.value).localeCompare(String(normalizedRight.value), 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  })
}

function getRowCellText(row: React.ReactNode, columnIndex: number) {
  if (!isElementWithChildren(row)) {
    return ''
  }

  const cells = React.Children.toArray(row.props.children)
  let currentIndex = 0

  for (const cell of cells) {
    if (!isElementWithChildren(cell)) {
      currentIndex += 1
      continue
    }

    const span = Math.max(1, Number(cell.props.colSpan ?? 1))
    if (columnIndex >= currentIndex && columnIndex < currentIndex + span) {
      return getNodeText(cell.props.children)
    }

    currentIndex += span
  }

  return ''
}

type TableProps = React.ComponentProps<'table'> & {
  containerClassName?: string
}

function Table({ className, containerClassName, ...props }: TableProps) {
  const [sort, setSort] = React.useState<TableSortState>(null)

  const toggleSort = React.useCallback((columnIndex: number) => {
    setSort((current) => {
      if (!current || current.columnIndex !== columnIndex) {
        return { columnIndex, direction: 'asc' }
      }

      if (current.direction === 'asc') {
        return { columnIndex, direction: 'desc' }
      }

      return null
    })
  }, [])

  const contextValue = React.useMemo(() => ({ sort, toggleSort }), [sort, toggleSort])

  return (
    <div
      data-slot="table-container"
      className={cn('relative w-full overflow-x-auto rounded-xl bg-background pr-3 md:overflow-auto', containerClassName)}
    >
      <TableContext.Provider value={contextValue}>
        <table
          data-slot="table"
          className={cn('w-full caption-bottom text-sm', className)}
          {...props}
        />
      </TableContext.Provider>
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <TableHeaderContext.Provider value={true}>
      <thead
        data-slot="table-header"
        className={cn('bg-muted [&_tr]:border-b-0 [&_tr]:bg-muted [&_tr]:hover:bg-muted', className)}
        {...props}
      />
    </TableHeaderContext.Provider>
  )
}

function TableBody({ className, children, ...props }: React.ComponentProps<'tbody'>) {
  const tableContext = React.useContext(TableContext)

  const sortedChildren = React.useMemo(() => {
    if (!tableContext?.sort) {
      return children
    }

    const { columnIndex, direction } = tableContext.sort
    const rows = React.Children.toArray(children)

    return rows
      .map((row, index) => ({
        index,
        row,
        value: getRowCellText(row, columnIndex),
      }))
      .sort((left, right) => {
        const result = compareSortValues(left.value, right.value)
        const stableResult = result === 0 ? left.index - right.index : result
        return direction === 'asc' ? stableResult : -stableResult
      })
      .map(({ row }) => row)
  }, [children, tableContext?.sort])

  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    >
      {sortedChildren}
    </tbody>
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  )
}

function TableRow({ className, children, ...props }: React.ComponentProps<'tr'>) {
  const isHeaderRow = React.useContext(TableHeaderContext)

  const rowChildren = isHeaderRow
    ? React.Children.map(children, (child, index) => {
        const childType = React.isValidElement(child) ? child.type : null
        const childDisplayName =
          (typeof childType === 'function' || (typeof childType === 'object' && childType !== null))
            ? (childType as { displayName?: string }).displayName
            : undefined
        const isTableHead =
          childType === TableHead ||
          childDisplayName === 'TableHead'

        if (React.isValidElement<TableHeadProps>(child) && isTableHead) {
          return React.cloneElement(child, { sortIndex: index })
        }

        return child
      })
    : children

  return (
    <tr
      data-slot="table-row"
      className={cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
        className,
      )}
      {...props}
    >
      {rowChildren}
    </tr>
  )
}

interface TableHeadProps extends React.ComponentProps<'th'> {
  width?: string
  sortable?: boolean
  sortIndex?: number
}

function TableHead({
  className,
  width,
  style,
  sortable,
  sortIndex,
  children,
  ...props
}: TableHeadProps) {
  const tableContext = React.useContext(TableContext)
  const label = getNodeText(children).trim()
  const normalizedLabel = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
  const canSort =
    Boolean(tableContext) &&
    typeof sortIndex === 'number' &&
    sortable !== false &&
    Boolean(label) &&
    normalizedLabel !== 'acoes'
  const activeDirection =
    canSort && tableContext?.sort?.columnIndex === sortIndex ? tableContext.sort.direction : null
  const SortIcon =
    activeDirection === 'asc' ? ArrowUp : activeDirection === 'desc' ? ArrowDown : ChevronsUpDown
  const alignRight = typeof className === 'string' && className.includes('text-right')

  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-11 bg-muted px-4 text-left align-middle font-medium whitespace-nowrap text-foreground shadow-[0_1px_0_0_var(--border)] first:rounded-tl-xl last:rounded-tr-xl md:sticky md:top-0 md:z-50 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      style={{ ...style, width }}
      {...props}
    >
      {canSort ? (
        <button
          type="button"
          className={cn(
            'group inline-flex w-full cursor-pointer items-center gap-1.5 rounded-sm text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            alignRight ? 'justify-end' : 'justify-start',
          )}
          onClick={() => tableContext?.toggleSort(sortIndex)}
          aria-label={`Ordenar por ${label}`}
        >
          <span>{children}</span>
          <SortIcon
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary',
              activeDirection && 'text-primary',
            )}
          />
        </button>
      ) : (
        children
      )}
    </th>
  )
}

;(TableHead as typeof TableHead & { displayName?: string }).displayName = 'TableHead'

interface TableCellProps extends React.ComponentProps<'td'> {
  width?: string
}

function TableCell({ className, width, style, ...props }: TableCellProps) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      style={{ ...style, width }}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
