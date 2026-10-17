package com.saiteja.pdfscanner.domain

/** Pure list operations behind page reordering, so they can be tested without a database. */
object PageOrder {

    fun <T> move(list: List<T>, from: Int, to: Int): List<T> {
        if (from !in list.indices) return list
        val target = to.coerceIn(0, list.lastIndex)
        if (from == target) return list
        val mutable = list.toMutableList()
        mutable.add(target, mutable.removeAt(from))
        return mutable
    }

    /** Moves the element with [id] by [delta] positions (negative = earlier). */
    fun moveBy(ids: List<String>, id: String, delta: Int): List<String> {
        val from = ids.indexOf(id)
        return if (from < 0) ids else move(ids, from, from + delta)
    }

    fun remove(ids: List<String>, id: String): List<String> = ids.filterNot { it == id }
}
