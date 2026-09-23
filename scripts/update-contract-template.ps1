param(
    [string[]] $TemplatePaths = @(
        "docs/contract/EDUCONNECT_HOP_DONG_TEMPLATE_V1.docx",
        "backend/contract-service/src/main/resources/contract-templates/EDUCONNECT_HOP_DONG_TEMPLATE_V1.docx"
    )
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

function Set-ParagraphText {
    param(
        [System.Xml.XmlElement] $Paragraph,
        [string] $Text,
        [System.Xml.XmlNamespaceManager] $Namespaces
    )

    $textNodes = @($Paragraph.SelectNodes(".//w:t", $Namespaces))
    if ($textNodes.Count -eq 0) {
        throw "Paragraph has no text node: $Text"
    }
    $textNodes[0].InnerText = $Text
    for ($index = 1; $index -lt $textNodes.Count; $index++) {
        $textNodes[$index].InnerText = ""
    }
}

function Find-Paragraph {
    param(
        [xml] $Document,
        [System.Xml.XmlNamespaceManager] $Namespaces,
        [string] $Text
    )

    return @($Document.SelectNodes("//w:p", $Namespaces)) |
        Where-Object { $_.InnerText.Trim() -eq $Text } |
        Select-Object -First 1
}

function Insert-ClausesAfter {
    param(
        [xml] $Document,
        [System.Xml.XmlNamespaceManager] $Namespaces,
        [string] $AnchorText,
        [string[]] $Clauses
    )

    $anchor = Find-Paragraph $Document $Namespaces $AnchorText
    if ($null -eq $anchor) {
        throw "Could not find template paragraph: $AnchorText"
    }

    $cursor = $anchor
    foreach ($clause in $Clauses) {
        if ($null -ne (Find-Paragraph $Document $Namespaces $clause)) {
            continue
        }
        $paragraph = $anchor.CloneNode($true)
        Set-ParagraphText $paragraph $clause $Namespaces
        [void] $cursor.ParentNode.InsertAfter($paragraph, $cursor)
        $cursor = $paragraph
    }
}

function Update-Template {
    param([string] $Path)

    $resolved = (Resolve-Path $Path).Path
    $archive = [System.IO.Compression.ZipFile]::Open($resolved, [System.IO.Compression.ZipArchiveMode]::Update)
    try {
        $entry = $archive.GetEntry("word/document.xml")
        if ($null -eq $entry) {
            throw "word/document.xml is missing from $Path"
        }

        $reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::UTF8)
        try {
            [xml] $document = $reader.ReadToEnd()
        } finally {
            $reader.Dispose()
        }

        $namespaces = [System.Xml.XmlNamespaceManager]::new($document.NameTable)
        $namespaces.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

        $replacements = [ordered]@{
            "HỢP ĐỒNG DỊCH VỤ KẾT NỐI GIA SƯVÀ HỌC VIÊN" = "HỢP ĐỒNG DỊCH VỤ KẾT NỐI GIA SƯ VÀ HỌC VIÊN"
            "STUDENT_ABSENT" = "STUDENT_ABSENT_TUTOR_PRESENT"
            "5.2. Hệ thống tổng hợp kết quả: BOTH_PRESENT khi cả hai bên điểm danh; STUDENT_ABSENT khi Gia sư điểm danh nhưng Học viên không điểm danh; TUTOR_ABSENT khi Gia sư không điểm danh theo điều kiện kết thúc buổi học." = "5.2. Hệ thống tổng hợp kết quả: BOTH_PRESENT khi cả hai bên điểm danh; STUDENT_ABSENT_TUTOR_PRESENT khi Gia sư điểm danh nhưng Học viên không điểm danh; TUTOR_ABSENT khi Gia sư không điểm danh theo điều kiện kết thúc buổi học."
            "Trạng thái agreement" = "Trạng thái tại thời điểm phát hành"
            "Thời điểm kích hoạt" = "Ghi nhận kích hoạt"
            "Phụ lục này là bộ phận không tách rời của Hợp đồng. Dòng mẫu dưới đây được lặp bằng poi-tl theo danh sách sessions; trường Link/địa chỉ phụ thuộc hình thức ONLINE hoặc OFFLINE." = "Phụ lục này là bộ phận không tách rời của Hợp đồng. Các dòng dưới đây thể hiện lịch học định kỳ trong snapshot đã ký; trường Link/địa chỉ phụ thuộc hình thức ONLINE hoặc OFFLINE."
        }
        foreach ($item in $replacements.GetEnumerator()) {
            $paragraph = Find-Paragraph $document $namespaces $item.Key
            if ($null -eq $paragraph) {
                if ($null -eq (Find-Paragraph $document $namespaces $item.Value)) {
                    throw "Could not find template text: $($item.Key)"
                }
                continue
            }
            Set-ParagraphText $paragraph $item.Value $namespaces
        }

        Insert-ClausesAfter $document $namespaces `
            "8.3. Việc tạm dừng luồng vận hành thông thường không được làm mất khả năng xử lý khiếu nại, hoàn tiền hoặc giải phóng khoản tiền đang bị khóa theo quyết định hợp lệ." @(
                "8.4. Bên B chỉ được đề nghị chấm dứt agreement của chính mình. Bên A chỉ được đề nghị dừng giảng dạy đối với toàn bộ lớp; đề nghị này không tự động làm chấm dứt hợp đồng hoặc phát sinh hoàn tiền.",
                "8.5. Sau khi tiếp nhận hồ sơ, các buổi học tương lai thuộc phạm vi đề nghị có thể được tạm dừng để thẩm định. Staff được phân công kiểm tra lý do và minh chứng, đề xuất hoặc từ chối; chỉ Admin có quyền phê duyệt việc thực thi chấm dứt và hoàn tiền.",
                "8.6. Các buổi đã diễn ra, đang quyết toán hoặc đang khiếu nại tiếp tục được xử lý theo Điều 5 và Điều 6. Khoản đã quyết toán hợp lệ không bị tính lại; phần quỹ của các buổi chưa diễn ra được hoàn theo kết quả thực thi Smart Contract Escrow.",
                "8.7. Chấm dứt agreement của một học viên không làm chấm dứt agreement của học viên khác. Khi Bên A được phê duyệt dừng cả lớp, hệ thống chỉ xử lý các agreement còn hiệu lực; agreement đã hoàn tất, hết hạn hoặc chấm dứt trước đó không bị xử lý hay hoàn tiền lần hai.",
                "8.8. Việc chấm dứt khóa các thao tác học tập tương lai thuộc phạm vi bị chấm dứt nhưng không xóa lịch sử buổi học, điểm danh, bài tập, quyết toán, khiếu nại và chứng cứ đã phát sinh hợp lệ."
            )

        Insert-ClausesAfter $document $namespaces `
            "11.4. Hợp đồng, các phụ lục, snapshot điều khoản và bản ghi chứng cứ điện tử là một bộ phận thống nhất. Nếu dữ liệu hiển thị mâu thuẫn, termsHash và snapshot đã được các bên xác nhận là căn cứ kỹ thuật để đối chiếu." @(
                "11.5. Tệp DOCX/PDF chính thức được phát hành từ snapshot đã ký và được lưu theo agreementId, contractVersion và mã kiểm tra toàn vẹn. Tệp này không bị ghi đè khi trạng thái vận hành của agreement thay đổi.",
                "11.6. Trạng thái ACTIVE, COMPLETED, EXPIRED hoặc CANCELLED tại thời điểm tra cứu được xác định theo hồ sơ vòng đời trên EduConnect và các giao dịch liên quan. Việc agreement chấm dứt hoặc hoàn tất không làm mất giá trị đối chiếu của Hợp đồng đối với quyền, nghĩa vụ và sự kiện đã phát sinh trước đó."
            )

        $gradeNode = $document.SelectSingleNode("//w:t[text()='{{studentGrade}}']", $namespaces)
        if ($null -ne $gradeNode) {
            $gradeTr = $gradeNode.SelectSingleNode("ancestor::w:tr", $namespaces)
            if ($null -ne $gradeTr) {
                [void] $gradeTr.ParentNode.RemoveChild($gradeTr)
            }
        }

        $entry.Delete()
        $newEntry = $archive.CreateEntry("word/document.xml", [System.IO.Compression.CompressionLevel]::Optimal)
        $writer = [System.IO.StreamWriter]::new($newEntry.Open(), [System.Text.UTF8Encoding]::new($false))
        try {
            $document.Save($writer)
        } finally {
            $writer.Dispose()
        }
    } finally {
        $archive.Dispose()
    }
}

foreach ($templatePath in $TemplatePaths) {
    Update-Template $templatePath
}



