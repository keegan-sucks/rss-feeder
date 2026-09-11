import QtQuick
import qs.Commons
import qs.Ui
import "Model.js" as Model

Item {
  id: root

  property var item: ({})
  property bool isRead: false
  property bool isSelected: false
  property string categoryName: ""
  property color contentForeground: Color.foreground
  property string contentFontFamily: Style.font.family

  signal activated()
  signal toggleRead()

  height: Style.space(42)
  width: parent ? parent.width : 300

  readonly property color mutedColor: Qt.rgba(contentForeground.r, contentForeground.g, contentForeground.b, 0.45)
  // Hover must stay true while the cursor is over ANY of the row's own mouse areas,
  // including the action buttons. Reading only mouseArea.containsMouse caused the
  // buttons to flicker: moving onto a button stole hover from the row, hid the
  // buttons, which released the cursor, which re-showed them — an endless loop.
  readonly property bool hovered: mouseArea.containsMouse
    || markZone.containsMouse
    || markHover.containsMouse
    || linkHover.containsMouse

  // Reserve a fixed strip on the right for the hover actions so the title text
  // never reflows when they appear/disappear (reflow was a second flicker source).
  readonly property int actionStripWidth: Style.space(72)

  Rectangle {
    anchors.fill: parent
    radius: Style.space(4)
    color: root.isSelected
      ? Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.14)
      : (root.hovered ? Qt.rgba(contentForeground.r, contentForeground.g, contentForeground.b, 0.05) : "transparent")

    Behavior on color { ColorAnimation { duration: 80 } }
  }

  // Row body click opens the article (unchanged behavior).
  MouseArea {
    id: mouseArea
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    onClicked: root.activated()
  }

  // Persistent, full-height mark-read zone on the left. Always visible and large,
  // so there is a stable target that never flashes and is hard to miss. Clicking
  // it toggles read/unread; it does NOT open the article.
  Rectangle {
    id: markZoneBg
    anchors.left: parent.left
    anchors.top: parent.top
    anchors.bottom: parent.bottom
    width: Style.space(26)
    radius: Style.space(4)
    color: markZone.containsMouse
      ? Qt.rgba(contentForeground.r, contentForeground.g, contentForeground.b, 0.08)
      : "transparent"

    Rectangle {
      anchors.centerIn: parent
      width: root.isRead ? Style.space(6) : Style.space(9)
      height: width
      radius: width / 2
      color: root.isRead ? "transparent" : Color.accent
      border.color: root.isRead ? Qt.rgba(contentForeground.r, contentForeground.g, contentForeground.b, 0.30) : "transparent"
      border.width: Style.space(1)
    }

    MouseArea {
      id: markZone
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: root.toggleRead()
    }
  }

  // Action buttons on the right, shown on hover or when selected.
  Row {
    id: actionRow
    visible: root.hovered || root.isSelected
    anchors.right: parent.right
    anchors.rightMargin: Style.space(6)
    anchors.verticalCenter: parent.verticalCenter
    spacing: Style.space(4)

    // Mark read/unread toggle (enlarged for an easy target).
    Rectangle {
      width: Style.space(30)
      height: Style.space(30)
      radius: Style.space(6)
      color: markHover.containsMouse ? Qt.rgba(contentForeground.r, contentForeground.g, contentForeground.b, 0.12) : "transparent"

      Text {
        anchors.centerIn: parent
        text: root.isRead ? "󰄱" : "󰄬"
        font.family: root.contentFontFamily
        font.pixelSize: Style.font.body
        color: root.isRead ? root.mutedColor : Color.accent
      }

      MouseArea {
        id: markHover
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.toggleRead()
      }
    }

    // Open in browser button (enlarged).
    Rectangle {
      width: Style.space(30)
      height: Style.space(30)
      radius: Style.space(6)
      color: linkHover.containsMouse ? Qt.rgba(contentForeground.r, contentForeground.g, contentForeground.b, 0.12) : "transparent"

      Text {
        anchors.centerIn: parent
        text: "󰌹"
        font.family: root.contentFontFamily
        font.pixelSize: Style.font.body
        color: root.mutedColor
      }

      MouseArea {
        id: linkHover
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.activated()
      }
    }
  }

  // Title and metadata column. Right edge is fixed (reserves the action strip)
  // so the text never shifts when the hover buttons toggle.
  Column {
    id: textCol
    anchors.left: markZoneBg.right
    anchors.leftMargin: Style.space(6)
    anchors.right: parent.right
    anchors.rightMargin: root.actionStripWidth
    anchors.verticalCenter: parent.verticalCenter
    spacing: 1

    Text {
      width: parent.width
      text: root.item.title || "Untitled"
      elide: Text.ElideRight
      textFormat: Text.PlainText
      font.family: root.contentFontFamily
      font.pixelSize: Style.font.body
      font.bold: !root.isRead
      color: root.isRead ? root.mutedColor : root.contentForeground
    }

    Text {
      width: parent.width
      text: {
        var parts = []
        if (root.categoryName) parts.push(root.categoryName)
        if (root.item.feedName) parts.push(root.item.feedName)
        var rel = Model.relativeTime(root.item.pubDateMs)
        if (rel) parts.push(rel)
        return parts.join(" · ")
      }
      elide: Text.ElideRight
      textFormat: Text.PlainText
      font.family: root.contentFontFamily
      font.pixelSize: Style.font.caption
      color: root.mutedColor
    }
  }
}
