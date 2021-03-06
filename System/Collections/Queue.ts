﻿///<reference path="ArrayUtility.ts"/>

/*
* @author electricessence / https://github.com/electricessence/
* Based Upon: http://referencesource.microsoft.com/#System/compmod/system/collections/generic/queue.cs
* Licensing: MIT https://github.com/electricessence/TypeScript.NET/blob/master/LICENSE
*/

module System.Collections
{
	var MINIMUM_GROW: number = 4 | 0;
	// var SHRINK_THRESHOLD: number = 32 | 0; // Unused?
	// var GROW_FACTOR: number = 200 | 0;  // double each time
	var GROW_FACTOR_HALF: number = 100 | 0;
	var DEFAULT_CAPACITY: number = MINIMUM_GROW;
	var emptyArray: any[] = [];

	function assertInteger(value: number, property: string): void
	{
		if (value != Math.floor(value))
			throw new Error("InvalidOperationException: " + property+" must be an interger.");

	}

	function assertZeroOrGreater(value: number, property: string): void
	{
		if (value < 0)
			throw new Error("ArgumentOutOfRangeException: " + property +" must be greater than zero");

	}

	function assertIntegerZeroOrGreater(value: number, property: string): void
	{
		assertInteger(value, property);
		assertZeroOrGreater(value, property);
	}

	export class Queue<T> implements ICollection<T>, IDisposable {
		
		//noinspection JSMismatchedCollectionQueryUpdate
		private _array: T[];
		private _head: number;       // First valid element in the queue
		private _tail: number;       // Last valid element in the queue
		private _size: number;       // Number of elements.
		private _capacity: number;   // Maps to _array.length;
        private _version: number;


		constructor(source?: IEnumerable<T>);
		constructor(source?: IArray<T>);
		constructor(capacity?: number);
		constructor(source?:any)
		{
			var _ = this;
			_._head = 0;
			_._tail = 0;
			_._size = 0;
			_._version = 0;

			if (!source)
				_._array = emptyArray;
			else
			{
				if (System.Types.isNumber(source))
				{
					assertIntegerZeroOrGreater(source, "source");

					_._array = source
						? ArrayUtility.initialize<T>(source)
						: emptyArray;
				}
				else
				{
					_._array = ArrayUtility.initialize<T>(
						source instanceof Array || "length" in source
						? source.length
						: DEFAULT_CAPACITY);

					Enumerable.forEach<T>(source, e=> _.enqueue(e));

					_._version = 0;
				}
			}

			_._capacity = _._array.length;
		}

		// #region ICollection<T> implementation

		get count(): number
		{
			return this._size;
		}

		get isReadOnly(): boolean
		{
			return false;
		}

		add(item: T): void
		{
			this.enqueue(item);
		}


		clear(): number
		{
			var _ = this, array = _._array, head = _._head, tail = _._tail, size = _._size;
			if (head < tail)
				ArrayUtility.clear(array, head, size);
			else
			{
				ArrayUtility.clear(array, head, array.length - head);
				ArrayUtility.clear(array, 0, tail);
			}

			_._head = 0;
			_._tail = 0;
			_._size = 0;
			_._version++;

			return size;
		}

		contains(item: T): boolean
		{
			var _ = this;
			var array = _._array, index = _._head, count = _._size, len = _._capacity;

			while (count-- > 0)
			{
				if (System.areEqual(array[index], item)) // May need a equality compare here.
					return true;

				index = (index + 1) % len;
			}

			return false;
		}


		copyTo(target:T[], arrayIndex:number = 0):void
        {
			if (target == null)
				throw new Error("ArgumentNullException: array cannot be null.");

			assertIntegerZeroOrGreater(arrayIndex, "arrayIndex");

			var arrayLen = target.length, _ = this, size = _._size;
    
            var numToCopy = (arrayLen - arrayIndex < size) ? (arrayLen - arrayIndex) : size;
			if (numToCopy == 0) return;

			var source = _._array, len = _._capacity, head = _._head, lh = len - head;
			var firstPart = (lh < numToCopy) ? lh : numToCopy;

			ArrayUtility.copyTo(source, target, head, arrayIndex, firstPart);
			numToCopy -= firstPart;

			if (numToCopy > 0)
				ArrayUtility.copyTo(source, target, 0, arrayIndex + len - head, numToCopy);
		}

		remove(item: T): number
		{
			throw new Error(
				"ICollection<T>.remove is not implemented in Queue<T> since it would require destroying the underlying array to remove the item.");
		}


		// #endregion

		// Results in a complete reset.  Allows for easy cleanup elsewhere.
		dispose(): void
		{
			var _ = this;
			_.clear();
			if (_._array != emptyArray)
			{
				_._array.length = _._capacity = 0;
				_._array = emptyArray;
			}
			_._version = 0;
		}

		toArray(): T[]
		{
			var _ = this, size = _._size;
			var arr: T[] = ArrayUtility.initialize<T>(size);
			if (size == 0)
				return arr;

			_.copyTo(arr);

			return arr;
		}

		setCapacity(capacity:number):void {

			assertIntegerZeroOrGreater(capacity, "capacity");

			var _ = this, array = _._array, len = _._capacity;

			if (capacity == len)
				return;

			var head = _._head, tail = _._tail, size = _._size;

			// Special case where we can simply extend the length of the array. (JavaScript only)
			if (array!=emptyArray && capacity > len && head < tail)
			{
				array.length = _._capacity = capacity;
				_._version++;
				return;
			}

			// We create a new array because modifying an existing one could be slow.
			var newarray: T[] = ArrayUtility.initialize<T>(capacity);
			if (size > 0)
			{
				if (head < tail)
				{
					ArrayUtility.copyTo(array, newarray, head, 0, size);
				} else
				{
					ArrayUtility.copyTo(array, newarray, head, 0, len - head);
					ArrayUtility.copyTo(array, newarray, 0, len - head, tail);
				}
			}

			_._array = newarray;
			_._capacity = capacity;
			_._head = 0;
			_._tail = (size == capacity) ? 0 : size;
			_._version++;
		}

		enqueue(item: T): void
		{
			var _ = this, array = _._array, size = _._size | 0, len = _._capacity | 0;
			if (size == len)
			{
				var newcapacity = len * GROW_FACTOR_HALF;
				if (newcapacity < len + MINIMUM_GROW)
					newcapacity = len + MINIMUM_GROW;

				_.setCapacity(newcapacity);
				array = _._array;
				len = _._capacity;
			}

			var tail = _._tail;
			array[tail] = item;
			_._tail = (tail + 1) % len;
			_._size = size + 1;
			_._version++;
		}

		dequeue(): T
		{
			var _ = this;
			if (_._size == 0)
				throw new Error("InvalidOperationException: cannot dequeue an empty queue.");

			var array = _._array, head = _._head;

            var removed = _._array[head];
			array[head] = null;
			_._head = (head + 1) % _._capacity;

			_._size--;


			/* Need a scheme for shrinking 
			if (_._size < _._capacity / 2)
			{
			}*/

			_._version++;
			return removed;
        }

		private _getElement(index:number):T
		{
			assertIntegerZeroOrGreater(index, "index");

			var _ = this;
			return _._array[(_._head + index) % _._capacity];
		}

		peek():T {
			if (this._size == 0)
				throw new Error("InvalidOperatioException: cannot call peek on an empty queue.");

			return this._array[this._head];
		}

		trimExcess(): void
		{
			var _ = this;
			var size = _._size;
			if (size < Math.floor(_._capacity * 0.9))
				_.setCapacity(size);
		}

		getEnumerator(): IEnumerator<T>
		{
			var _ = this;
			var index: number;
			var version: number;
			return new EnumeratorBase<T>(
				() =>
				{
					version = _._version;
					index = 0;
				},
				yielder =>
				{
					if (version != _._version)
						throw new Error("InvalidOperationException: collection was changed during enumeration.");

					if (index == _._size)
						return yielder.yieldBreak();

					return yielder.yieldReturn(_._getElement(index++));
				});
		}

	}

}