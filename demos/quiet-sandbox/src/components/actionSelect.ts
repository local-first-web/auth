import {
    createPrompt,
    useState,
    useKeypress,
    usePrefix,
    usePagination,
    useRef,
    useMemo,
    isBackspaceKey,
    isEnterKey,
    isUpKey,
    isDownKey,
    isNumberKey,
    Separator,
    ValidationError,
    makeTheme,
    type Theme,
} from '@inquirer/core';
import type { PartialDeep } from '@inquirer/type';
import chalk from 'chalk';
import ansiEscapes from 'ansi-escapes';
import figures from '@inquirer/figures';

type SelectTheme = {
    icon: { cursor: string };
    style: { disabled: (text: string) => string };
};

const selectTheme: SelectTheme = {
    icon: { cursor: figures.pointer},
    style: { disabled: (text: string) => chalk.dim(`- ${text}`) },
};

type Action<ActionValue> = {
    value: ActionValue;
    name: string;
    key: string;
}

type Choice<Value> = {
    value: Value;
    name?: string;
    description?: string;
    disabled?: boolean | string;
    type?: never;
};

type ActionSelectConfig<ActionValue, Value> = {
    message: string;
    actions: ReadonlyArray<Action<ActionValue>>;
    choices: ReadonlyArray<Choice<Value> | Separator>;
    pageSize?: number;
    loop?: boolean;
    default?: unknown;
    theme?: PartialDeep<Theme<SelectTheme>>;
    // TODO: Allow assigning a default action for enter rather than returning an undefined action
};

type ActionSelectResult<ActionValue, Value> = {
    action?: ActionValue;
    answer: Value;
}

type Item<Value> = Separator | Choice<Value>;

function isSelectable<Value>(item: Item<Value>): item is Choice<Value> {
    return !Separator.isSeparator(item) && !item.disabled;
}

export default createPrompt(
    <ActionValue, Value>(config: ActionSelectConfig<ActionValue, Value>, done: (result: ActionSelectResult<ActionValue, Value>) => void): string => {
        const { choices: items, loop = true, pageSize = 7 } = config;
        const firstRender = useRef(true);
        const theme = makeTheme<SelectTheme>(selectTheme, config.theme);
        const prefix = usePrefix({ theme });
        const [status, setStatus] = useState('pending');
        const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

        const bounds = useMemo(() => {
            const first = items.findIndex(isSelectable);
            const last = items.findLastIndex(isSelectable);

            if (first < 0) {
                throw new ValidationError(
                    '[select prompt] No selectable choices. All choices are disabled.',
                );
            }

            return { first, last };
        }, [items]);

        const defaultItemIndex = useMemo(() => {
            if (!('default' in config)) return -1;
            return items.findIndex(
                (item) => isSelectable(item) && item.value === config.default,
            );
        }, [config.default, items]);

        const [active, setActive] = useState(
            defaultItemIndex === -1 ? bounds.first : defaultItemIndex,
        );

        const [selectedAction, setSelectedAction] = useState<Action<ActionValue> | undefined>(undefined);

        // Safe to assume the cursor position always point to a Choice.
        const selectedChoice = items[active] as Choice<Value>;

        useKeypress((key, rl) => {
            clearTimeout(searchTimeoutRef.current);

            const action = config.actions.find(action => action.key === key.name)
            if (action !== undefined) {
                setStatus('done');
                setSelectedAction(action)
                done({
                    action: action.value,
                    answer: selectedChoice.value
                });
            } else if (isEnterKey(key)) {
                setStatus('done');
                done({
                    action: undefined,
                    answer: selectedChoice.value
                });
            } else if (isUpKey(key) || isDownKey(key)) {
                rl.clearLine(0);
                if (
                    loop ||
                    (isUpKey(key) && active !== bounds.first) ||
                    (isDownKey(key) && active !== bounds.last)
                ) {
                    const offset = isUpKey(key) ? -1 : 1;
                    let next = active;
                    do {
                        next = (next + offset + items.length) % items.length;
                    } while (!isSelectable(items[next]!));
                    setActive(next);
                }
            } else if (isNumberKey(key)) {
                rl.clearLine(0);
                const position = Number(key.name) - 1;
                const item = items[position];
                if (item != null && isSelectable(item)) {
                    setActive(position);
                }
            } else if (isBackspaceKey(key)) {
                rl.clearLine(0);
            } else {
                // FIXME: you probably won't be able to search some items because their names gets captured by an action
                // use a modifier key to enter search?

                // Default to search
                const searchTerm = rl.line.toLowerCase();
                const matchIndex = items.findIndex((item) => {
                    if (Separator.isSeparator(item) || !isSelectable(item)) return false;

                    return String(item.name || item.value)
                        .toLowerCase()
                        .startsWith(searchTerm);
                });

                if (matchIndex >= 0) {
                    setActive(matchIndex);
                }

                searchTimeoutRef.current = setTimeout(() => {
                    rl.clearLine(0);
                }, 700);
            }
        });

        const message = theme.style.message(config.message);

        const helpTip = config.actions.map(action => `${theme.style.help(action.name)} ${theme.style.key(action.key.toUpperCase())}`).join(' ');

        const page = usePagination<Item<Value>>({
            items,
            active,
            renderItem({ item, isActive }: { item: Item<Value>; isActive: boolean }) {
                if (Separator.isSeparator(item)) {
                    return ` ${item.separator}`;
                }

                const line = item.name || item.value;
                if (item.disabled) {
                    const disabledLabel =
                        typeof item.disabled === 'string' ? item.disabled : '(disabled)';
                    return theme.style.disabled(`${line} ${disabledLabel}`);
                }

                const color = isActive ? theme.style.highlight : (x: string) => x;
                const cursor = isActive ? theme.icon.cursor : ` `;
                return color(`${cursor} ${line}`);
            },
            pageSize,
            loop,
            theme,
        });

        if (status === 'done') {
            const answer =
                selectedChoice.name ||
                // TODO: Could we enforce that at the type level? Name should be defined for non-string values.
                String(selectedChoice.value);

            if (selectedAction !== undefined) {
                const action =
                    selectedAction.name ||
                    String(selectedAction.value);
                // TODO: separate theme style for action
                return `${prefix} ${message} ${theme.style.help(action)} ${theme.style.answer(answer)}`;
            } else {
                return `${prefix} ${message} ${theme.style.answer(answer)}`;
            }
        }

        const choiceDescription = selectedChoice.description
            ? `\n${selectedChoice.description}`
            : ``;

        return `${[prefix, message, helpTip].filter(Boolean).join(' ')}\n${page}${choiceDescription}${ansiEscapes.cursorHide}`;
    },
);
